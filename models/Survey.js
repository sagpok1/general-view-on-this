const { db } = require('../config/database');

const Survey = {
  findAll() {
    return db.prepare("SELECT * FROM surveys WHERE status = 'active'").all();
  },

  findById(id) {
    return db.prepare('SELECT * FROM surveys WHERE id = ?').get(id);
  },

  getQuestions(surveyId) {
    return db.prepare(
      'SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY order_index'
    ).all(surveyId);
  },

  hasCompleted(userId, surveyId) {
    const row = db.prepare(
      'SELECT 1 FROM survey_completions WHERE user_id = ? AND survey_id = ?'
    ).get(userId, surveyId);
    return !!row;
  },

  complete(userId, surveyId, responses) {
    const completeTransaction = db.transaction(() => {
      const completionResult = db.prepare(
        'INSERT INTO survey_completions (user_id, survey_id) VALUES (?, ?)'
      ).run(userId, surveyId);

      const completionId = completionResult.lastInsertRowid;

      const insertResponse = db.prepare(
        'INSERT INTO survey_responses (completion_id, question_id, answer) VALUES (?, ?, ?)'
      );

      for (const response of responses) {
        insertResponse.run(completionId, response.question_id, response.answer);
      }

      db.prepare(
        'UPDATE users SET credits = credits + 1 WHERE id = ?'
      ).run(userId);

      db.prepare(
        `INSERT INTO credit_transactions (user_id, amount, reason, reference_id)
         VALUES (?, 1, 'survey_completion', ?)`
      ).run(userId, surveyId);

      return db.prepare('SELECT * FROM survey_completions WHERE id = ?').get(completionId);
    });

    return completeTransaction();
  },

  getAvailableForUser(userId) {
    return db.prepare(
      `SELECT s.*
       FROM surveys s
       LEFT JOIN survey_completions sc ON s.id = sc.survey_id AND sc.user_id = ?
       WHERE s.status = 'active' AND sc.id IS NULL`
    ).all(userId);
  },

  getCompletedByUser(userId) {
    return db.prepare(
      `SELECT s.*, sc.completed_at
       FROM surveys s
       INNER JOIN survey_completions sc ON s.id = sc.survey_id
       WHERE sc.user_id = ?`
    ).all(userId);
  },

  getStats() {
    const surveys = db.prepare('SELECT COUNT(*) AS totalSurveys FROM surveys').get();
    const completions = db.prepare('SELECT COUNT(*) AS totalCompletions FROM survey_completions').get();
    return {
      totalSurveys: surveys.totalSurveys,
      totalCompletions: completions.totalCompletions
    };
  }
};

module.exports = Survey;
