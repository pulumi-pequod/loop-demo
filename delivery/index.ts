import * as delivery from "@pulumi/delivery";

const ORG_REPO = process.env.DEMO_REPO ?? "pulumi-pequod/loop-demo"; // TODO: real repo
const APPROVERS = ["v-adam-pulumi-corp"];                             // TODO: user or team

const repo = new delivery.GitHubSource("repo", {
    repository: ORG_REPO,
    branch: "main",
    trigger: { paths: ["app/**", "delivery/**"] },
});

const pipeline = new delivery.Pipeline("loop", {
    program: { source: repo, directory: "delivery" },
});

// One stage per environment. Same members, different stack.
function deploy(stage: delivery.Stage, env: string) {
    const app = new delivery.Stacks(env, {
        stage,
        stacks: { app: { stack: `loop-app/${env}`, source: repo, directory: "app" } },
    });
    new delivery.Job(`smoke-${env}`, {
        stage,
        source: repo,
        directory: "delivery",
        command: "sh smoke.sh",
        environment: { ENDPOINT: app.outputs.apply(o => String(o["app"]["endpoint"])) },
    });
}

const dev = new delivery.Stage("dev", { pipeline });
deploy(dev, "dev");

const staging = new delivery.Stage("staging", { pipeline, from: [dev] });
deploy(staging, "staging");

// Nothing reaches prod until a named person approves. The approval shows the preview.
const prod = new delivery.Stage("prod", {
    pipeline,
    from: [staging],
    when: delivery.approval({ approvers: APPROVERS }),
});
deploy(prod, "prod");

export const release = pipeline.releaseNumber;
