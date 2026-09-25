# Final plan step

After all code or file manipulation work in a plan is done, run the project's CI suite as a final validation step before marking the plan complete. Use it to catch loose ends the implementation may have missed (type errors, lint violations, failing tests).

Treat CI failures as plan findings: fix them or report them, do not mark the plan complete while the suite fails.
