export async function pollWorkflow(
  workflow: string,
  since: string,
  intervalMs: number,
  onTick: (elapsed: number) => void,
  maxIterations = 200,
): Promise<void> {
  // Subtract 30s from since to handle browser/GitHub server clock skew.
  // Risk of catching a previous run is low — runs are spaced at least 30 min apart.
  const sinceBuffered = new Date(new Date(since).getTime() - 30_000).toISOString();

  let elapsed = 0;
  for (let i = 0; i < maxIterations; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    elapsed += intervalMs / 1000;
    onTick(elapsed);
    try {
      const res = await fetch(
        `/api/run-all?workflow=${workflow}&since=${encodeURIComponent(sinceBuffered)}`,
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (data.status === "completed") {
        if (data.conclusion !== "success") throw new Error(`${workflow}: ${data.conclusion}`);
        return;
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes(":")) throw e;
    }
  }
  throw new Error(`${workflow} timed out after ${Math.round((elapsed / 60))}m`);
}
