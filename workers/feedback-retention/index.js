const batchSize = 100;
const maxBatches = 10;

export default {
  async scheduled(controller, env) {
    let deleted = 0;
    try {
      const cutoff = new Date(controller.scheduledTime).toISOString().slice(0, 19).replace('T', ' ');
      for (let batch = 0; batch < maxBatches; batch += 1) {
        const { success, results } = await env.FEEDBACK_DB.prepare(
          `DELETE FROM feedback WHERE id IN (
             SELECT id FROM feedback WHERE expires_at <= ? ORDER BY expires_at, id LIMIT ?
           ) RETURNING 1 AS deleted`
        ).bind(cutoff, batchSize).all();
        if (!success || !Array.isArray(results)) throw new Error();
        deleted += results.length;
        if (results.length < batchSize) break;
      }
      console.log({ deleted, code: 'ok' });
    } catch {
      console.error({ deleted, code: 'feedback_retention_failed' });
      throw new Error('feedback_retention_failed');
    }
  }
};
