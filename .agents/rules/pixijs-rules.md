# PixiJS v8 Essential Rules for Neon Shape Merge Game

> This file contains curated PixiJS v8 best practices relevant to this game project.
> Full docs: https://pixijs.com/8.x/guides

---

## Performance Tips

### General
- Only optimize when you need to! PixiJS can handle a fair amount of content off the bat
- Be mindful of the complexity of your scene. The more objects you add the slower things will end up
- Order can help: sprite / sprite / graphic / graphic is faster than sprite / graphic / sprite / graphic
- Culling is disabled by default. Set `cullable = true` on objects. If GPU-bound it will improve performance; if CPU-bound it will degrade performance

### Sprites
- Use Spritesheets where possible to minimize total textures
- Sprites can be batched with up to 16 different textures (dependent on hardware)
- This is the fastest way to render content
- Draw order can be important

### Graphics
- Graphics objects are fastest when they are not modified constantly (not including transform, alpha or tint!)
- Graphics objects are batched when under a certain size (100 points or smaller)
- Small Graphics objects are as fast as Sprites (rectangles, triangles)
- Using 100s of complex graphics objects can be slow, use sprites instead (create a texture with `generateTexture`)

### Text
- Avoid changing text on every frame as this is expensive (each time it draws to a canvas and uploads to GPU)
- **BitmapText gives much better performance** for dynamically changing text
- Text resolution matches the renderer resolution; decrease resolution yourself by setting the `resolution` property

### Filters
- Release memory: `container.filters = null`
- If you know the size: `container.filterArea = new Rectangle(x,y,w,h)` speeds things up
- Filters are expensive, using too many will slow things down!

### BlendModes
- Different blend modes cause batches to break (de-optimize)
- Group objects with same blend mode together for fewer draw calls

### Events
- If an object has no interactive children use `interactiveChildren = false`
- Setting `hitArea = new Rectangle(x,y,w,h)` stops the event system from crawling through the object

---

## Garbage Collection

### Explicit Resource Management
Always call `destroy` on objects you no longer need:

```javascript
sprite.destroy();
```

### Texture Management
- Use `texture.unload()` to manually unload textures from GPU
- Use `texture.destroy()` to fully destroy textures
- If you plan to destroy many textures at once, add a random delay to avoid freezing

### Automatic GC (TextureGCSystem)
- Removes textures unused for 3600 frames (~1 minute at 60 FPS)
- Configurable via `textureGCMaxIdle` and `textureGCCheckCountMax`

```javascript
await app.init({
  textureGCActive: true,
  textureGCMaxIdle: 7200,
  textureGCCheckCountMax: 1200,
});
```

### Best Practices
1. Explicitly destroy objects when done
2. Use pooling to reduce allocation/deallocation overhead
3. Proactively manage textures with `texture.unload()`

---

## Render Groups

RenderGroups are containers within your scene graph that act like mini scene graphs. They allow transform calculations (position, scale, rotation), tint, and alpha to be offloaded to the GPU.

```ts
const myGameWorld = new Container({ isRenderGroup: true });
const myHud = new Container({ isRenderGroup: true });
scene.addChild(myGameWorld, myHud);
```

**When to use:**
- **Static Content**: Content that doesn't change often (scene structure, not values)
- **Distinct Scene Parts**: Separate game world from HUD

**Best Practices:**
- Don't overuse — too many Render Groups can degrade performance
- Profile when using them. Most of the time you won't need them

---

## Application Init (v8 Async Pattern)

```ts
const app = new PIXI.Application();
await app.init({
  width: 800, height: 600,
  backgroundColor: 0x1099bb,
  antialias: true,
  resolution: 1,
  autoDensity: true,
});
document.body.appendChild(app.canvas);
```

---

## Container

Container is the base class for all scene objects in v8. Only Containers can have children.

```ts
const group = new Container();
group.addChild(spriteA, spriteB);
app.stage.addChild(group);
```

**Key Properties**: position, rotation, scale, alpha, pivot, skew, visible

**Leaf nodes** (Sprite, Text, Graphics) should NOT have children. Wrap them in a Container if nesting is required.

---

## Sprite

```ts
const sprite = new Sprite(texture);
sprite.anchor.set(0.5);
sprite.position.set(100, 100);
sprite.scale.set(2);
```

- Changing `sprite.texture` automatically triggers visual update
- `width`/`height` are convenience setters for `scale`

---

## Graphics (v8 API)

Build shape first, then fill/stroke:

```ts
const g = new Graphics()
  .rect(50, 50, 100, 100).fill(0xff0000)
  .circle(200, 200, 50).stroke({ color: 0x00ff00, width: 2 });
```

**Shape methods**: `rect()`, `circle()`, `ellipse()`, `poly()`, `roundRect()`, `star()`, `regularPoly()`, `moveTo()`, `lineTo()`, `arc()`, `bezierCurveTo()`

**Fill/Stroke**: `.fill(color | options)`, `.stroke(color | options)`, `.cut()` for holes

### GraphicsContext (sharing geometry)
```ts
const context = new GraphicsContext().circle(100, 100, 50).fill('red');
const shapeA = new Graphics(context);
const shapeB = new Graphics(context); // shares same geometry
```

### Performance
- **Do NOT clear/rebuild graphics every frame** — swap prebuilt `GraphicsContext` instead
- Use `Graphics.destroy()` to clean up
- Use many simple Graphics over one complex one for GPU batching

---

## Textures

### Lifecycle
```
Source File → TextureSource → Texture → Sprite
```

### Key Operations
- `await Assets.load('image.png')` — load texture
- `Texture.from(resource)` — create from loaded resource (NOT from URL in v8!)
- `app.renderer.generateTexture({ target: container })` — render to texture
- `texture.destroy()` / `Assets.unload('image.png')` — free memory
- `texture.source.unload()` — unload from GPU but keep in memory

### TextureSource Properties
- `scaleMode`: `'linear'` | `'nearest'`
- `wrapMode`: `'clamp-to-edge'` | `'repeat'` | `'mirror-repeat'`

---

## Ticker

```ts
app.ticker.add((ticker) => {
  bunny.rotation += ticker.deltaTime * 0.1;
});
```

- `ticker.deltaTime` — scaled frame delta
- `ticker.elapsedMS` — unscaled delta in ms
- `ticker.start()` / `ticker.stop()` — control ticker
- `ticker.maxFPS = 60` — limit framerate

---

## Text (Canvas)

```ts
const text = new Text({
  text: 'Hello!',
  style: { fill: '#ffffff', fontSize: 36, fontFamily: 'Arial' },
  anchor: 0.5,
});
```

⚠️ Changing text/style re-rasterizes. **Avoid every frame.**

---

## BitmapText (High Performance Text)

Best for frequently updating text (scores, timers, HUD):

```ts
const text = new BitmapText({
  text: 'Score: 0',
  style: { fontFamily: 'MyFont', fontSize: 32, fill: '#ffcc00' },
});
```

- ✅ No per-frame rasterization — text changes are cheap
- ✅ Efficient memory — shares glyph textures
- ⚠️ Not suitable for CJK/emoji — use `Text` for those

---

## ParticleContainer (High Performance Particles)

For rendering 100,000+ lightweight particles:

```ts
const container = new ParticleContainer({
  dynamicProperties: {
    position: true,
    rotation: false,
    vertex: false,
    color: false,
  },
});

const particle = new Particle({
  texture, x: 200, y: 100,
  scaleX: 0.8, rotation: Math.PI / 4, tint: 0xff0000,
});
container.addParticle(particle);
```

- Uses `addParticle()`/`removeParticle()` instead of `addChild()`
- Particles are lighter than Sprites — no children, events, or filters
- Declare static vs dynamic properties for optimal GPU upload

---

## Filters

```ts
sprite.filters = [new BlurFilter({ strength: 8 })];
```

Built-in: `AlphaFilter`, `BlurFilter`, `ColorMatrixFilter`, `DisplacementFilter`, `NoiseFilter`

Release: `sprite.filters = null;`

---

## Scene Graph Key Concepts

- Root = `app.stage`
- Parent transforms cascade to children (position, rotation, scale, alpha)
- Render order = tree insertion order (later children render on top)
- Use `zIndex` + `sortableChildren = true` for custom ordering
- `cullable = true` for viewport culling optimization
