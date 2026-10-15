# Regression evidence before the navbar fix

These observations belong to export `_XqXe7JZIBqPzXc_-5GiC`, before the
`overwrite: 'auto'` compatibility correction. They are not the final build's
results; those are in [the current report](../results.md).

- [Original browser observations](results.json): 128 passed, two navigation
  assertions failed. The navbar failure is shown in [hidden-navbar.jpg](hidden-navbar.jpg).
- [Rapid baseline comparison](rapid-comparison.json): the original preview
  passed a sequence that left the modified preview's navbar hidden. The race
  was intermittent; longer waits passed in both builds.
- [In-memory validation](../in-memory-overwrite-validation.json) tested the
  old export with only the shell tween's overwrite option replaced in a browser
  response. Four rapid round trips passed. No generated file was patched.
- [Paused menu](paused-menu.jpg): the separate 40vw offset was also reproduced
  in the original preview; [baseline evidence](../baseline-paused-navigation.json).

The production fix was then tested with a failing-then-passing real-GSAP unit
test, rebuilt through the export script, and checked in the final browser run.
