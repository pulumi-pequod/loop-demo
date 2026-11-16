import * as delivery from "@pulumi/delivery";

const ORG_REPO = "pulumi-pequod/loop-demo";
const APPROVERS = ["v-adam-pulumi-corp"];

const repo = new delivery.GitHubSource("repo", {
    repository: ORG_REPO,
    branch: "main",
    trigger: { paths: ["app/**", "delivery/**"] },
});

const pipeline = new delivery.Pipeline("loop", {
    program: { source: repo, directory: "delivery" },
});

// Deploy loop-app to one or more stacks in a stage, then smoke-test each one.
function deploy(stage: delivery.Stage, name: string, envs: string[]) {
    const stacks: Record<string, delivery.types.input.StacksEntryArgs> = {};
    for (const env of envs) {
        stacks[env] = { stack: `loop-app/${env}`, source: repo, directory: "app" };
    }
    const app = new delivery.Stacks(name, { stage, stacks });
    for (const env of envs) {
        new delivery.Job(`smoke-${env}`, {
            stage,
            source: repo,
            directory: "delivery",
            command: "sh smoke.sh",
            environment: { ENDPOINT: app.outputs.apply(o => String(o[env]["endpoint"])) },
        });
    }
}

const dev = new delivery.Stage("dev", { pipeline });
deploy(dev, "dev", ["dev"]);

const staging = new delivery.Stage("staging", { pipeline, from: [dev] });
deploy(staging, "staging", ["staging"]);

// Production is two regions. Nothing reaches them until a named person approves,
// and the approval shows the preview for both.
const REGIONS = ["us", "eu"];
const prod = new delivery.Stage("prod", {
    pipeline,
    from: [staging],
    when: delivery.approval({ approvers: APPROVERS }),
});
deploy(prod, "prod", REGIONS.map(r => `prod-${r}`));

export const release = pipeline.releaseNumber;
