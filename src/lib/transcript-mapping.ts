// The one place that turns a pasted transcript into answers for a script's questions (BRIEF section 7).
// v1 has no AI, so this finds nothing and Adam fills answers by hand. To add AI later, replace the body
// of mapTranscriptToAnswers with a model call; the interview form already calls it and shows the result.

export type MappableQuestion = { questionId: string; text: string };

/** Returns answer text keyed by question id, for the questions it could answer from the transcript. */
export function mapTranscriptToAnswers(transcript: string, questions: MappableQuestion[]): Record<string, string> {
  void transcript;
  void questions;
  return {};
}

export const TRANSCRIPT_MAPPING_AVAILABLE = false;
