export async function pollWorkflow(
  workflow: string,
  since: string,
  intervalMs: number,
  onTick: (elapsed: number) => void,
): Promise<void> {
  let elapsed = 0;
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    elapsed += intervalMs / 1000;
    onTick(elapsed);
    try {
      const res = await fetch(
        `/api/run-all?workflow=${workflow}&since=${encodeURIComponent(since)}`,
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
  throw new Error(`${workflow} timed out`);
}
