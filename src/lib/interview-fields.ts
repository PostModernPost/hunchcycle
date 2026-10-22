// The free-text fields every interview has, whatever its script (BRIEF section 3), plus the paste areas.
export const INTERVIEW_TEXT_FIELDS = [
  "problem",
  "persona",
  "surprise",
  "bestQuote",
  "questionThatGotQuote",
  "observation",
  "insights",
  "coldHotNote",
  "nextAction",
  "stage",
  "scoreNote",
  "comments",
  "method",
  "solution",
  "sale",
  "transcriptText",
  "summaryText",
] as const;

export type InterviewTextField = (typeof INTERVIEW_TEXT_FIELDS)[number];

export type InterviewInput = {
  id?: string;
  personId: string;
  newPersonName: string;
  runId: string;
  scriptId: string;
  date: string;
  interviewers: string;
  recordingDevice: string;
  fields: Record<InterviewTextField, string>;
  coldHot: string;
  score: string;
  scoreSource: string;
  answers: { questionId: string; text: string; asked: string }[];
};
