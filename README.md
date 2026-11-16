# full-loop-demo

Demo code for the Agents + Delivery full-loop video (MA-1195). Script and notes: ~/para/projects/launch-full-loop-video/

- app/: loop-app (Lambda + function URL), stacks dev, staging, prod-us (us-west-2), prod-eu (eu-west-1)
- delivery/: the release pipeline (Pulumi Delivery): dev → staging → approval → prod in two regions
- ops/: the Deploy Troubleshooter agent, started by any failed update on a loop-app stack (pulumiservice 1.7.0)
