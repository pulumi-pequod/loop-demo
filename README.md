# full-loop-demo

Demo code for the Agents + Delivery full-loop video (MA-1195). Script and notes: ~/para/projects/launch-full-loop-video/

- app/: loop-app (Lambda + URL), stacks dev/staging/prod. The log group has no retention on purpose.
- delivery/: the release pipeline (Pulumi Delivery)
- ops/: the hygiene-reviewer agent and its weekly automation (pulumiservice 1.7.0)
