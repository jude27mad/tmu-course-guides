// Assessments that are sittings rather than submissions: math quizzes, midterms and finals, and CEN100's
// in-class design review and presentations. Once one has passed it "took place"; calling it past due
// reads like a missed deadline for something the student has already written.
export const isSitting = (courseId, row) => (courseId === 'cen100' ? /^(review|presentation-)/.test(row?.id || '') : ['quiz', 'midterm', 'final'].includes(row?.kind));

// "Took place" for a passed sitting, otherwise "Past due".
export const passedWord = (courseId, row) => (isSitting(courseId, row) ? 'Took place' : 'Past due');
