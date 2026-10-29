# 3D models

- A code block tagged `jscad` draws a **3D model** from
  [JSCAD](https://openjscad.xyz) code: search "3D model" in the
  palette, or pick "JSCAD (3D model)" as a code block's language. The
  model is the figure; click it to see and edit its code (it redraws
  as you type), drag it to turn it, or pick Front / Right / Top in its
  header.
- Write `main()` returning shapes from `require('@jscad/modeling')`,
  the way JSCAD's own examples do; `getParameterDefinitions`
  defaults are used. The code runs sealed off: no network, no files,
  and at most five seconds. The *Parametric parts* example shows a
  bracket, a gear and a coloured assembly.
- A model can take its sizes from a **dataset**: write
  `params=@sizes row=2` after `jscad` on the fence, or pick the
  dataset and row in the model's header. The row's columns replace
  the parameter defaults by name. **Export STL** in the header saves
  the model for 3D printing or CAD.
- **The model follows the row you work in**: click a cell of its
  dataset and the model shows that row. Change a number and press Tab
  or Enter (or click elsewhere) - the model redraws when you leave the
  cell, not on every key. When two models read the same dataset, each
  keeps the row it was given, so they can be compared.
