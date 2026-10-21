---
theme: technical
---

# Parametric parts

Each drawing below is a **JSCAD** model: a few lines of code that
build a solid. folio draws it as part of the page, in the theme's
colours, and it prints like any other figure. Click a model to see
and edit its code (it redraws as you type); drag it to turn it, or
pick a view from its header.

The code runs in a sealed sandbox: no network, no files, and no more
than five seconds. A document can describe a part, but it can't do
anything else.

## Mounting bracket

A plate with two mounting holes and a stiffening flange, in three
sizes. The sizes are a **dataset**; the model reads one row of it
(`params=@bracket-sizes`). Pick another row in the model's header, or
change a number in the table, and the drawing follows. **Export STL**
in the header saves the part for a 3D printer.

::: table {#bracket-sizes}
caption: "Bracket sizes (mm)"
columns:
  - {name: size, type: text}
  - {name: length, type: number, unit: "mm", align: right}
  - {name: flangeHeight, type: number, unit: "mm", align: right}
  - {name: holeRadius, type: number, unit: "mm", align: right}
data:
  - [small, 40, 14, 2]
  - [medium, 60, 20, 3]
  - [large, 90, 28, 5]
:::

```jscad params=@bracket-sizes row=2
const { cuboid, cylinder } = require('@jscad/modeling').primitives
const { subtract, union } = require('@jscad/modeling').booleans
const { translate } = require('@jscad/modeling').transforms

// Defaults when no dataset row is bound.
const getParameterDefinitions = () => [
  { name: 'length', type: 'number', initial: 60 },
  { name: 'flangeHeight', type: 'number', initial: 20 },
  { name: 'holeRadius', type: 'number', initial: 3 },
]

const main = ({ length, flangeHeight, holeRadius }) => {
  const plate = cuboid({ size: [length, 30, 3] })
  const flange = translate(
    [0, 13.5, flangeHeight / 2],
    cuboid({ size: [length, 3, flangeHeight] }),
  )
  const hole = (x) =>
    translate([x, -2, 0], cylinder({ radius: holeRadius, height: 4, segments: 40 }))
  return subtract(union(plate, flange), hole(-length / 3), hole(length / 3))
}

module.exports = { main, getParameterDefinitions }
```

## A spur gear

Sixteen teeth around a hub, built in a loop: the kind of shape that
is tedious to draw by hand and trivial to describe.

```jscad
const { cylinder, cuboid } = require('@jscad/modeling').primitives
const { union, subtract } = require('@jscad/modeling').booleans
const { rotateZ, translate } = require('@jscad/modeling').transforms

const teeth = 16
const radius = 20

const main = () => {
  const body = cylinder({ radius, height: 6, segments: 64 })
  const tooth = translate([radius + 2, 0, 0], cuboid({ size: [6, 3.5, 6] }))
  const ring = []
  for (let i = 0; i < teeth; i++) {
    ring.push(rotateZ((i * 2 * Math.PI) / teeth, tooth))
  }
  const bore = cylinder({ radius: 5, height: 8, segments: 32 })
  return subtract(union(body, ...ring), bore)
}

module.exports = { main }
```

## A coloured assembly

Shapes can carry their own colours: here a base and a pin, each
coloured in the code.

```jscad
const { cuboid, cylinder, sphere } = require('@jscad/modeling').primitives
const { colorize } = require('@jscad/modeling').colors
const { translate } = require('@jscad/modeling').transforms

const main = () => [
  colorize([0.35, 0.42, 0.5], cuboid({ size: [40, 40, 6] })),
  colorize([0.85, 0.55, 0.2], translate([0, 0, 13], cylinder({ radius: 4, height: 20, segments: 40 }))),
  colorize([0.85, 0.55, 0.2], translate([0, 0, 25], sphere({ radius: 6, segments: 32 }))),
]

module.exports = { main }
```

## In the source

A model is an ordinary fenced code block tagged `jscad`, so on
GitHub it reads as JavaScript. Insert a new one with the palette
(search "3D model"), or pick "JSCAD (3D model)" as any code block's
language.
