const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'generalviewonthis.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create all tables on startup
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    google_id TEXT,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'personal',
    credits INTEGER NOT NULL DEFAULT 0,
    avatar_url TEXT,
    bio TEXT,
    is_admin INTEGER DEFAULT 0,
    email_verified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
    business_name TEXT NOT NULL,
    category TEXT,
    address TEXT,
    phone TEXT,
    description TEXT,
    logo_url TEXT,
    is_verified INTEGER DEFAULT 0,
    avg_rating REAL DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    business_id INTEGER NOT NULL REFERENCES businesses(id),
    items_description TEXT NOT NULL,
    special_notes TEXT,
    credits_spent INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS surveys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS survey_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    survey_id INTEGER NOT NULL REFERENCES surveys(id),
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL,
    options TEXT,
    order_index INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS survey_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    survey_id INTEGER NOT NULL REFERENCES surveys(id),
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, survey_id)
  );

  CREATE TABLE IF NOT EXISTS survey_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    completion_id INTEGER NOT NULL REFERENCES survey_completions(id),
    question_id INTEGER NOT NULL REFERENCES survey_questions(id),
    response_text TEXT
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reviewer_id INTEGER NOT NULL REFERENCES users(id),
    business_id INTEGER NOT NULL REFERENCES businesses(id),
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    title TEXT,
    body TEXT NOT NULL,
    review_type TEXT DEFAULT 'user_to_business',
    target_user_id INTEGER REFERENCES users(id),
    status TEXT DEFAULT 'published',
    verified_at DATETIME,
    verified_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS credit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    reference_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

function seedData() {
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@generalviewonthis.com');
  if (existingAdmin) {
    console.log('Seed data already exists, skipping.');
    return;
  }

  const adminHash = bcrypt.hashSync('admin123', 10);
  const businessHash = bcrypt.hashSync('password123', 10);

  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, name, account_type, credits, is_admin, email_verified)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBusiness = db.prepare(`
    INSERT INTO businesses (user_id, business_name, category, address, phone, description, is_verified)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSurvey = db.prepare(`
    INSERT INTO surveys (title, description, category, is_active)
    VALUES (?, ?, ?, 1)
  `);

  const insertQuestion = db.prepare(`
    INSERT INTO survey_questions (survey_id, question_text, question_type, options, order_index)
    VALUES (?, ?, ?, ?, ?)
  `);

  const seedTransaction = db.transaction(() => {
    // 1. Admin user
    const adminResult = insertUser.run(
      'admin@generalviewonthis.com', adminHash, 'Admin User', 'personal', 100, 1, 1
    );
    console.log(`Seeded admin user (id: ${adminResult.lastInsertRowid})`);

    // 2. Business users and profiles
    const businessSeeds = [
      {
        email: 'cornerbakehouse@generalviewonthis.com',
        name: 'Corner Bakehouse Team',
        businessName: 'The Corner Bakehouse',
        category: 'restaurant',
        address: '123 Main St',
        phone: '555-0101',
        description: 'Artisan breads and pastries baked fresh daily with locally sourced ingredients.'
      },
      {
        email: 'greenleaf@generalviewonthis.com',
        name: 'Green Leaf Team',
        businessName: 'Green Leaf Market',
        category: 'retail',
        address: '456 Oak Ave',
        phone: '555-0102',
        description: 'Organic produce and specialty groceries from local farms and vendors.'
      },
      {
        email: 'quickfix@generalviewonthis.com',
        name: 'Quick Fix Team',
        businessName: 'Quick Fix Repairs',
        category: 'service',
        address: '789 Elm Blvd',
        phone: '555-0103',
        description: 'Fast and reliable repair services for electronics, appliances, and more.'
      },
      {
        email: 'sunrisecoffee@generalviewonthis.com',
        name: 'Sunrise Coffee Team',
        businessName: 'Sunrise Coffee Co.',
        category: 'restaurant',
        address: '321 Pine St',
        phone: '555-0104',
        description: 'Specialty coffee roasted in-house with a cozy atmosphere and fresh pastries.'
      },
      {
        email: 'bellasboutique@generalviewonthis.com',
        name: 'Bella Martinez',
        businessName: "Bella's Boutique",
        category: 'retail',
        address: '654 Cedar Ln',
        phone: '555-0105',
        description: 'Curated fashion and accessories from local designers and artisans.'
      }
    ];

    for (const b of businessSeeds) {
      const userResult = insertUser.run(
        b.email, businessHash, b.name, 'business', 50, 0, 1
      );
      insertBusiness.run(
        userResult.lastInsertRowid, b.businessName, b.category, b.address, b.phone, b.description, 1
      );
    }
    console.log('Seeded 5 business users and profiles.');

    // 3. Surveys with questions
    const surveySeeds = [
      {
        title: "What's your favorite type of local restaurant?",
        description: 'Help us understand dining preferences in the community.',
        category: 'food',
        questions: [
          { text: 'What cuisine do you prefer most?', type: 'multiple_choice', options: JSON.stringify(['Italian', 'Mexican', 'Asian', 'American', 'Mediterranean']) },
          { text: 'How important is organic/locally sourced food to you?', type: 'rating', options: null },
          { text: 'How often do you eat out at local restaurants per week?', type: 'multiple_choice', options: JSON.stringify(['Never', '1-2 times', '3-4 times', '5+ times']) },
          { text: 'What is your ideal price range for a meal?', type: 'multiple_choice', options: JSON.stringify(['Under $10', '$10-$20', '$20-$35', '$35+']) },
          { text: 'What would make you try a new local restaurant?', type: 'text', options: null }
        ]
      },
      {
        title: 'How often do you visit local businesses vs online shopping?',
        description: 'Understanding shopping habits to support local commerce.',
        category: 'shopping',
        questions: [
          { text: 'What percentage of your shopping is done locally vs online?', type: 'multiple_choice', options: JSON.stringify(['Mostly local (75%+)', 'More local (50-75%)', 'About equal', 'More online (50-75%)', 'Mostly online (75%+)']) },
          { text: 'Rate your overall satisfaction with local shopping options.', type: 'rating', options: null },
          { text: 'What categories do you prefer to buy locally?', type: 'multiple_choice', options: JSON.stringify(['Groceries', 'Clothing', 'Electronics', 'Home goods', 'Gifts']) },
          { text: 'What prevents you from shopping locally more often?', type: 'text', options: null }
        ]
      },
      {
        title: 'What would improve your neighborhood most?',
        description: 'Share your vision for community improvement.',
        category: 'community',
        questions: [
          { text: 'Which area needs the most improvement?', type: 'multiple_choice', options: JSON.stringify(['Parks and green spaces', 'Roads and sidewalks', 'Public safety', 'Local businesses', 'Community events']) },
          { text: 'How would you rate the current state of your neighborhood?', type: 'rating', options: null },
          { text: 'How long have you lived in this neighborhood?', type: 'multiple_choice', options: JSON.stringify(['Less than 1 year', '1-3 years', '3-5 years', '5-10 years', '10+ years']) },
          { text: 'What specific improvement would have the biggest impact?', type: 'text', options: null },
          { text: 'Would you volunteer for community improvement projects?', type: 'multiple_choice', options: JSON.stringify(['Yes, regularly', 'Occasionally', 'Rarely', 'No']) }
        ]
      },
      {
        title: 'Rate your satisfaction with local food delivery options',
        description: 'Help local restaurants improve their delivery services.',
        category: 'food',
        questions: [
          { text: 'How often do you order food delivery from local restaurants?', type: 'multiple_choice', options: JSON.stringify(['Daily', 'Several times a week', 'Once a week', 'A few times a month', 'Rarely']) },
          { text: 'Rate the delivery speed of local restaurants.', type: 'rating', options: null },
          { text: 'Rate the food quality upon delivery.', type: 'rating', options: null },
          { text: 'Which delivery platform do you use most?', type: 'multiple_choice', options: JSON.stringify(['Direct from restaurant', 'DoorDash', 'UberEats', 'Grubhub', 'Other']) },
          { text: 'What could local restaurants do to improve delivery?', type: 'text', options: null }
        ]
      },
      {
        title: 'What type of local events do you enjoy?',
        description: 'Help us plan better community events.',
        category: 'events',
        questions: [
          { text: 'What type of events interest you most?', type: 'multiple_choice', options: JSON.stringify(['Farmers markets', 'Live music', 'Food festivals', 'Art shows', 'Sports events']) },
          { text: 'How often do you attend local events?', type: 'multiple_choice', options: JSON.stringify(['Weekly', 'Monthly', 'A few times a year', 'Rarely', 'Never']) },
          { text: 'Rate your satisfaction with the variety of local events.', type: 'rating', options: null },
          { text: 'What new event would you like to see in your area?', type: 'text', options: null }
        ]
      },
      {
        title: 'How do you usually find new local restaurants?',
        description: 'Understanding discovery channels for local dining.',
        category: 'food',
        questions: [
          { text: 'How do you typically discover new local restaurants?', type: 'multiple_choice', options: JSON.stringify(['Word of mouth', 'Social media', 'Google search', 'Walking by', 'Review apps']) },
          { text: 'How much do online reviews influence your decision?', type: 'rating', options: null },
          { text: 'Which social media platform helps you find restaurants?', type: 'multiple_choice', options: JSON.stringify(['Instagram', 'TikTok', 'Facebook', 'X/Twitter', 'None']) },
          { text: 'What information matters most when choosing a new restaurant?', type: 'text', options: null }
        ]
      },
      {
        title: 'What matters most when choosing a local business?',
        description: 'Help businesses understand customer priorities.',
        category: 'shopping',
        questions: [
          { text: 'What is the most important factor?', type: 'multiple_choice', options: JSON.stringify(['Price', 'Quality', 'Convenience', 'Customer service', 'Supporting local']) },
          { text: 'How important is a loyalty or rewards program?', type: 'rating', options: null },
          { text: 'Do you prefer businesses with an online presence?', type: 'multiple_choice', options: JSON.stringify(['Yes, essential', 'Nice to have', 'Doesn\'t matter', 'Prefer no online presence']) },
          { text: 'Rate how much you value personalized customer service.', type: 'rating', options: null },
          { text: 'What would make you switch from a chain to a local business?', type: 'text', options: null }
        ]
      },
      {
        title: 'How would you rate public transport in your area?',
        description: 'Evaluate local transportation infrastructure.',
        category: 'community',
        questions: [
          { text: 'What is your primary mode of transportation?', type: 'multiple_choice', options: JSON.stringify(['Car', 'Public transit', 'Bicycle', 'Walking', 'Rideshare']) },
          { text: 'Rate the reliability of public transportation.', type: 'rating', options: null },
          { text: 'Rate the affordability of public transportation.', type: 'rating', options: null },
          { text: 'How far is the nearest public transit stop from your home?', type: 'multiple_choice', options: JSON.stringify(['Under 5 min walk', '5-10 min walk', '10-20 min walk', '20+ min walk', 'No transit nearby']) },
          { text: 'What single change would most improve your commute?', type: 'text', options: null }
        ]
      }
    ];

    for (const survey of surveySeeds) {
      const surveyResult = insertSurvey.run(
        survey.title, survey.description, survey.category
      );
      const surveyId = surveyResult.lastInsertRowid;

      for (let i = 0; i < survey.questions.length; i++) {
        const q = survey.questions[i];
        insertQuestion.run(surveyId, q.text, q.type, q.options, i + 1);
      }
    }
    console.log('Seeded 8 surveys with questions.');
  });

  seedTransaction();
  console.log('Database seeding complete.');
}

module.exports = { db, seedData };
