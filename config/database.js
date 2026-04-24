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

  CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    close_date TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS prediction_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prediction_id INTEGER NOT NULL REFERENCES predictions(id),
    label TEXT NOT NULL,
    order_index INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS prediction_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    prediction_id INTEGER NOT NULL REFERENCES predictions(id),
    option_id INTEGER NOT NULL REFERENCES prediction_options(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, prediction_id)
  );

  CREATE TABLE IF NOT EXISTS game_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    game TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

function seedPredictions() {
  const row = db.prepare('SELECT COUNT(*) AS c FROM predictions').get();
  if (row.c > 0) return;

  const insertPrediction = db.prepare(`
    INSERT INTO predictions (title, description, category, close_date, status)
    VALUES (?, ?, ?, ?, 'open')
  `);
  const insertOption = db.prepare(`
    INSERT INTO prediction_options (prediction_id, label, order_index)
    VALUES (?, ?, ?)
  `);

  const seeds = [
    {
      title: 'Will a local farmers market open downtown this year?',
      description: 'Community prediction on whether a new farmers market will be announced before December.',
      category: 'community',
      close_date: '2026-12-31',
      options: ['Yes', 'No']
    },
    {
      title: 'Which cuisine will top next month\'s restaurant openings?',
      description: 'Which cuisine will dominate new local restaurant openings in the coming weeks.',
      category: 'food',
      close_date: '2026-06-30',
      options: ['Italian', 'Mexican', 'Asian', 'American', 'Mediterranean']
    },
    {
      title: 'Will remote work stay above 30% of local jobs in 2026?',
      description: 'Forecast the share of remote/hybrid jobs in your area for the rest of the year.',
      category: 'work',
      close_date: '2026-12-31',
      options: ['Yes, stays above 30%', 'No, will drop below']
    },
    {
      title: 'Which EV brand will see the biggest adoption spike locally?',
      description: 'Pick the EV maker most likely to grow fastest in your community this year.',
      category: 'tech',
      close_date: '2026-12-31',
      options: ['Tesla', 'Ford', 'Rivian', 'Hyundai/Kia', 'Chinese brands']
    },
    {
      title: 'Will coffee prices rise again this summer?',
      description: 'Community outlook on whether a pound of coffee beans will trend higher by August.',
      category: 'food',
      close_date: '2026-08-31',
      options: ['Higher', 'About the same', 'Lower']
    },
    {
      title: 'Which streaming service will gain the most subscribers in 2026?',
      description: 'Predict the biggest streaming winner for the year among US viewers.',
      category: 'entertainment',
      close_date: '2026-12-31',
      options: ['Netflix', 'Disney+', 'Max', 'Apple TV+', 'Amazon Prime']
    },
    {
      title: 'Will your city add new bike lanes this year?',
      description: 'Forecast whether your local government will announce new bike infrastructure.',
      category: 'community',
      close_date: '2026-12-31',
      options: ['Yes', 'No', 'Only pilot / temporary']
    },
    {
      title: 'Which sport will have the most-watched finals in 2026?',
      description: 'Predict the most-watched US championship game or series this year.',
      category: 'sports',
      close_date: '2026-12-31',
      options: ['NFL Super Bowl', 'NBA Finals', 'World Series', 'Stanley Cup', 'MLS Cup']
    },
    {
      title: 'Will home prices in your area rise, fall, or stay flat?',
      description: 'Community take on local housing trends through the end of the year.',
      category: 'housing',
      close_date: '2026-12-31',
      options: ['Rise 5%+', 'Slight rise', 'Flat', 'Slight fall', 'Fall 5%+']
    },
    {
      title: 'Which social platform will teens use most by year-end?',
      description: 'Pick the platform with the largest under-25 share by December.',
      category: 'tech',
      close_date: '2026-12-31',
      options: ['TikTok', 'Instagram', 'YouTube', 'Snapchat', 'Something new']
    },
    {
      title: 'Will gas prices average below $3.50/gal this summer?',
      description: 'Forecast US summer gas price trend.',
      category: 'economy',
      close_date: '2026-09-01',
      options: ['Yes, below $3.50', 'No, above $3.50']
    },
    {
      title: 'Will your favorite local restaurant still be open in 12 months?',
      description: 'A friendly community gut-check on small business survival.',
      category: 'food',
      close_date: '2027-04-23',
      options: ['Definitely', 'Probably', 'Not sure', 'Probably not']
    }
  ];

  const tx = db.transaction(() => {
    for (const p of seeds) {
      const r = insertPrediction.run(p.title, p.description, p.category, p.close_date);
      const pid = r.lastInsertRowid;
      p.options.forEach((label, i) => insertOption.run(pid, label, i));
    }
  });
  tx();
  console.log(`Seeded ${seeds.length} predictions.`);
}

function seedData() {
  seedPredictions();

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

    // Additional US-themed surveys
    const usSurveySeeds = [
      {
        title: 'Best US National Parks You Have Visited',
        description: 'Share your experiences exploring America\'s natural wonders.',
        category: 'travel',
        questions: [
          { text: 'Which national park is your favorite?', type: 'multiple_choice', options: JSON.stringify(['Yellowstone', 'Grand Canyon', 'Yosemite', 'Zion', 'Great Smoky Mountains']) },
          { text: 'How many national parks have you visited?', type: 'multiple_choice', options: JSON.stringify(['None', '1-3', '4-7', '8-15', '16+']) },
          { text: 'Rate the accessibility of US national parks.', type: 'rating', options: null },
          { text: 'What park would you recommend to a first-time visitor?', type: 'text', options: null }
        ]
      },
      {
        title: 'Your Favorite American Comfort Foods',
        description: 'Celebrate the diverse food culture across the United States.',
        category: 'food',
        questions: [
          { text: 'Which comfort food is your go-to?', type: 'multiple_choice', options: JSON.stringify(['Mac and cheese', 'Fried chicken', 'Burgers', 'Pizza', 'BBQ ribs']) },
          { text: 'Which regional cuisine do you enjoy most?', type: 'multiple_choice', options: JSON.stringify(['Southern/Soul food', 'Tex-Mex', 'New England seafood', 'Midwest comfort', 'California fresh']) },
          { text: 'Rate how important food traditions are to you.', type: 'rating', options: null },
          { text: 'What is your favorite homemade comfort food recipe?', type: 'text', options: null }
        ]
      },
      {
        title: 'How Do You Feel About the US Healthcare System?',
        description: 'Share your perspectives on healthcare access and quality.',
        category: 'general',
        questions: [
          { text: 'Do you currently have health insurance?', type: 'multiple_choice', options: JSON.stringify(['Yes, employer-provided', 'Yes, marketplace/ACA', 'Yes, Medicare/Medicaid', 'No insurance', 'Other']) },
          { text: 'Rate your overall satisfaction with your healthcare.', type: 'rating', options: null },
          { text: 'What is the biggest barrier to healthcare for you?', type: 'multiple_choice', options: JSON.stringify(['Cost', 'Availability of doctors', 'Wait times', 'Insurance complexity', 'No barriers']) },
          { text: 'What one change would improve US healthcare most?', type: 'text', options: null }
        ]
      },
      {
        title: 'US Sports Fandom Survey',
        description: 'How passionate are Americans about their sports teams?',
        category: 'general',
        questions: [
          { text: 'Which sport do you follow most closely?', type: 'multiple_choice', options: JSON.stringify(['NFL Football', 'NBA Basketball', 'MLB Baseball', 'NHL Hockey', 'MLS Soccer', 'None']) },
          { text: 'How often do you attend live sporting events?', type: 'multiple_choice', options: JSON.stringify(['Weekly', 'Monthly', 'A few times a year', 'Once a year', 'Never']) },
          { text: 'Rate how important sports are to your social life.', type: 'rating', options: null },
          { text: 'Who is your all-time favorite athlete and why?', type: 'text', options: null }
        ]
      },
      {
        title: 'The American Road Trip Experience',
        description: 'Share your love for the open road across America.',
        category: 'travel',
        questions: [
          { text: 'How often do you take road trips?', type: 'multiple_choice', options: JSON.stringify(['Multiple times a year', 'Once a year', 'Every few years', 'Rarely', 'Never']) },
          { text: 'What is your ideal road trip length?', type: 'multiple_choice', options: JSON.stringify(['Weekend (2-3 days)', 'One week', 'Two weeks', 'A month+', 'Day trip']) },
          { text: 'Rate the quality of US highways and rest stops.', type: 'rating', options: null },
          { text: 'What was the most memorable US road trip you have taken?', type: 'text', options: null }
        ]
      },
      {
        title: 'Your Thoughts on US Public Education',
        description: 'How do Americans view their education system?',
        category: 'general',
        questions: [
          { text: 'How would you rate the quality of public schools in your area?', type: 'rating', options: null },
          { text: 'What grade level concerns you most?', type: 'multiple_choice', options: JSON.stringify(['Elementary', 'Middle school', 'High school', 'College', 'All equally']) },
          { text: 'What should schools focus more on?', type: 'multiple_choice', options: JSON.stringify(['STEM subjects', 'Arts and creativity', 'Life skills', 'Trades and vocational', 'Social-emotional learning']) },
          { text: 'What would you change about US education?', type: 'text', options: null }
        ]
      },
      {
        title: 'Coffee Culture in America',
        description: 'How does America fuel its caffeine habit?',
        category: 'food',
        questions: [
          { text: 'How many cups of coffee do you drink daily?', type: 'multiple_choice', options: JSON.stringify(['None', '1 cup', '2-3 cups', '4-5 cups', '6+']) },
          { text: 'Where do you usually get your coffee?', type: 'multiple_choice', options: JSON.stringify(['Home brewed', 'Starbucks', 'Local coffee shop', 'Dunkin', 'Gas station/convenience store']) },
          { text: 'Rate the quality of local coffee shops in your area.', type: 'rating', options: null },
          { text: 'What makes the perfect cup of coffee for you?', type: 'text', options: null }
        ]
      },
      {
        title: 'Living Costs Across the US',
        description: 'Share your perspective on cost of living in America.',
        category: 'general',
        questions: [
          { text: 'How would you rate the affordability of your area?', type: 'rating', options: null },
          { text: 'What is your biggest monthly expense?', type: 'multiple_choice', options: JSON.stringify(['Housing/Rent', 'Transportation', 'Food/Groceries', 'Healthcare', 'Childcare']) },
          { text: 'Have you considered relocating for lower costs?', type: 'multiple_choice', options: JSON.stringify(['Yes, actively planning', 'Considering it', 'Thought about it', 'No, I am happy here', 'Already relocated']) },
          { text: 'What would make your area more affordable to live in?', type: 'text', options: null }
        ]
      },
      {
        title: 'Streaming and Entertainment Habits',
        description: 'How Americans consume entertainment in the digital age.',
        category: 'general',
        questions: [
          { text: 'Which streaming service do you use most?', type: 'multiple_choice', options: JSON.stringify(['Netflix', 'Disney+', 'HBO Max', 'Hulu', 'Amazon Prime', 'YouTube']) },
          { text: 'How many hours of streaming do you watch per day?', type: 'multiple_choice', options: JSON.stringify(['Less than 1', '1-2 hours', '2-4 hours', '4-6 hours', '6+']) },
          { text: 'Rate your satisfaction with streaming content quality.', type: 'rating', options: null },
          { text: 'What type of content do you wish there was more of?', type: 'text', options: null }
        ]
      },
      {
        title: 'US Housing Market Opinions',
        description: 'Perspectives on buying, renting, and the American dream of homeownership.',
        category: 'general',
        questions: [
          { text: 'Do you currently own or rent your home?', type: 'multiple_choice', options: JSON.stringify(['Own', 'Rent', 'Live with family', 'Other arrangement']) },
          { text: 'Rate how achievable homeownership feels for you.', type: 'rating', options: null },
          { text: 'What is the biggest obstacle to buying a home?', type: 'multiple_choice', options: JSON.stringify(['Down payment', 'High prices', 'Interest rates', 'Student debt', 'Low inventory']) },
          { text: 'Where in the US would you most like to own a home?', type: 'text', options: null }
        ]
      },
      {
        title: 'American Holidays and Traditions',
        description: 'Celebrate what makes American holidays special.',
        category: 'general',
        questions: [
          { text: 'Which holiday is your favorite?', type: 'multiple_choice', options: JSON.stringify(['Thanksgiving', 'Fourth of July', 'Christmas', 'Halloween', 'Memorial Day/Labor Day']) },
          { text: 'How important are holiday traditions to your family?', type: 'rating', options: null },
          { text: 'How do you typically spend Thanksgiving?', type: 'multiple_choice', options: JSON.stringify(['Big family dinner', 'Friendsgiving', 'Travel', 'Quiet day at home', 'Volunteering']) },
          { text: 'What is your favorite holiday tradition?', type: 'text', options: null }
        ]
      },
      {
        title: 'Fitness and Wellness in America',
        description: 'How do Americans stay healthy and active?',
        category: 'general',
        questions: [
          { text: 'How often do you exercise per week?', type: 'multiple_choice', options: JSON.stringify(['Never', '1-2 times', '3-4 times', '5-6 times', 'Daily']) },
          { text: 'Where do you prefer to work out?', type: 'multiple_choice', options: JSON.stringify(['Gym', 'Home', 'Outdoors', 'Group classes', 'Sports leagues']) },
          { text: 'Rate the availability of fitness facilities in your area.', type: 'rating', options: null },
          { text: 'What motivates you most to stay healthy?', type: 'text', options: null }
        ]
      },
      {
        title: 'Social Media Use in America',
        description: 'Understanding how Americans interact with social platforms.',
        category: 'general',
        questions: [
          { text: 'Which social media platform do you use most?', type: 'multiple_choice', options: JSON.stringify(['Instagram', 'TikTok', 'Facebook', 'X/Twitter', 'Reddit', 'LinkedIn']) },
          { text: 'How many hours per day do you spend on social media?', type: 'multiple_choice', options: JSON.stringify(['Less than 1', '1-2 hours', '2-4 hours', '4+ hours', 'I do not use social media']) },
          { text: 'Rate social media\'s impact on your daily life.', type: 'rating', options: null },
          { text: 'What would you change about social media?', type: 'text', options: null }
        ]
      },
      {
        title: 'The US Job Market Experience',
        description: 'Share your thoughts on working in America today.',
        category: 'general',
        questions: [
          { text: 'What is your current work arrangement?', type: 'multiple_choice', options: JSON.stringify(['Full-time office', 'Full-time remote', 'Hybrid', 'Part-time', 'Freelance/Self-employed', 'Not working']) },
          { text: 'Rate your overall job satisfaction.', type: 'rating', options: null },
          { text: 'What benefit matters most to you?', type: 'multiple_choice', options: JSON.stringify(['Health insurance', 'Flexible schedule', 'Remote work', 'Retirement/401k', 'Paid time off']) },
          { text: 'What is the biggest challenge in your career right now?', type: 'text', options: null }
        ]
      },
      {
        title: 'American Pet Ownership',
        description: 'The US loves its pets — tell us about yours!',
        category: 'general',
        questions: [
          { text: 'Do you currently own a pet?', type: 'multiple_choice', options: JSON.stringify(['Dog', 'Cat', 'Both', 'Other pet', 'No pets']) },
          { text: 'How much do you spend monthly on your pet?', type: 'multiple_choice', options: JSON.stringify(['No pet', 'Under $50', '$50-$100', '$100-$200', '$200+']) },
          { text: 'Rate the pet-friendliness of your neighborhood.', type: 'rating', options: null },
          { text: 'What is the best thing about having a pet?', type: 'text', options: null }
        ]
      },
      {
        title: 'Climate and Weather Preferences',
        description: 'What climate do Americans prefer to live in?',
        category: 'general',
        questions: [
          { text: 'Which climate do you prefer?', type: 'multiple_choice', options: JSON.stringify(['Warm and sunny (Florida, Arizona)', 'Four seasons (Northeast)', 'Mild and rainy (Pacific NW)', 'Dry and hot (Southwest)', 'Tropical (Hawaii)']) },
          { text: 'Has weather influenced where you choose to live?', type: 'multiple_choice', options: JSON.stringify(['Yes, it was the main factor', 'Somewhat', 'Not really', 'No, other factors matter more']) },
          { text: 'Rate your satisfaction with your current climate.', type: 'rating', options: null },
          { text: 'If weather was the only factor, where in the US would you live?', type: 'text', options: null }
        ]
      },
      {
        title: 'US Grocery Shopping Habits',
        description: 'How do Americans shop for groceries?',
        category: 'food',
        questions: [
          { text: 'Where do you primarily buy groceries?', type: 'multiple_choice', options: JSON.stringify(['Walmart', 'Costco/Sam\'s Club', 'Kroger/Safeway', 'Whole Foods/Trader Joe\'s', 'Local grocery store', 'Online delivery']) },
          { text: 'How much do you spend weekly on groceries?', type: 'multiple_choice', options: JSON.stringify(['Under $50', '$50-$100', '$100-$150', '$150-$200', '$200+']) },
          { text: 'Rate the quality of fresh produce in your area.', type: 'rating', options: null },
          { text: 'What would improve your grocery shopping experience?', type: 'text', options: null }
        ]
      },
      {
        title: 'Tipping Culture in America',
        description: 'Share your views on the American tipping system.',
        category: 'general',
        questions: [
          { text: 'How much do you typically tip at restaurants?', type: 'multiple_choice', options: JSON.stringify(['Under 15%', '15%', '18-20%', '20-25%', '25%+']) },
          { text: 'Do you think tipping should be replaced by higher wages?', type: 'multiple_choice', options: JSON.stringify(['Yes, eliminate tipping', 'Mostly yes', 'Not sure', 'Mostly no', 'No, keep tipping']) },
          { text: 'Rate how comfortable you are with tipping expectations.', type: 'rating', options: null },
          { text: 'What is your opinion on tip screens at counter-service places?', type: 'text', options: null }
        ]
      },
      {
        title: 'US Travel Destinations Bucket List',
        description: 'Which American destinations are on your must-visit list?',
        category: 'travel',
        questions: [
          { text: 'Which US city would you most like to visit?', type: 'multiple_choice', options: JSON.stringify(['New York City', 'Los Angeles', 'Nashville', 'New Orleans', 'San Francisco', 'Miami']) },
          { text: 'How many US states have you visited?', type: 'multiple_choice', options: JSON.stringify(['1-5', '6-15', '16-25', '26-40', '40+', 'All 50!']) },
          { text: 'Rate how much you enjoy traveling within the US.', type: 'rating', options: null },
          { text: 'What US destination surprised you the most?', type: 'text', options: null }
        ]
      },
      {
        title: 'Electric Vehicles in America',
        description: 'Are Americans ready for the EV revolution?',
        category: 'general',
        questions: [
          { text: 'Do you own or plan to buy an electric vehicle?', type: 'multiple_choice', options: JSON.stringify(['Already own one', 'Planning to buy', 'Considering it', 'Not interested', 'Cannot afford one']) },
          { text: 'What is the biggest barrier to EV adoption for you?', type: 'multiple_choice', options: JSON.stringify(['Price', 'Charging infrastructure', 'Range anxiety', 'Prefer gas vehicles', 'Apartment living/no charger']) },
          { text: 'Rate the EV charging infrastructure in your area.', type: 'rating', options: null },
          { text: 'What would make you switch to an electric vehicle?', type: 'text', options: null }
        ]
      },
      {
        title: 'Small Town vs Big City Living',
        description: 'Which lifestyle do Americans prefer?',
        category: 'community',
        questions: [
          { text: 'Where do you currently live?', type: 'multiple_choice', options: JSON.stringify(['Large city (500k+)', 'Mid-size city (100-500k)', 'Small city (25-100k)', 'Small town (<25k)', 'Rural area']) },
          { text: 'Where would you prefer to live?', type: 'multiple_choice', options: JSON.stringify(['Downtown big city', 'Suburb of big city', 'Mid-size city', 'Small town', 'Rural/countryside']) },
          { text: 'Rate your satisfaction with your current community size.', type: 'rating', options: null },
          { text: 'What do you love most about where you live?', type: 'text', options: null }
        ]
      },
      {
        title: 'The American Music Scene',
        description: 'What sounds define America today?',
        category: 'general',
        questions: [
          { text: 'What genre of music do you listen to most?', type: 'multiple_choice', options: JSON.stringify(['Pop', 'Hip-hop/Rap', 'Country', 'Rock', 'R&B', 'Electronic/EDM']) },
          { text: 'How do you primarily listen to music?', type: 'multiple_choice', options: JSON.stringify(['Spotify', 'Apple Music', 'YouTube', 'Radio', 'Vinyl/CDs', 'SoundCloud']) },
          { text: 'Rate the live music scene in your area.', type: 'rating', options: null },
          { text: 'Who is your favorite current American artist?', type: 'text', options: null }
        ]
      },
      {
        title: 'US Internet and Broadband Access',
        description: 'Is the digital divide still a problem in America?',
        category: 'general',
        questions: [
          { text: 'How would you rate your internet speed?', type: 'rating', options: null },
          { text: 'Who is your internet provider?', type: 'multiple_choice', options: JSON.stringify(['Comcast/Xfinity', 'AT&T', 'Spectrum', 'Verizon', 'T-Mobile/Starlink', 'Other']) },
          { text: 'How much do you pay monthly for internet?', type: 'multiple_choice', options: JSON.stringify(['Under $30', '$30-$50', '$50-$75', '$75-$100', '$100+']) },
          { text: 'What frustrates you most about internet service in the US?', type: 'text', options: null }
        ]
      },
      {
        title: 'American Fast Food Favorites',
        description: 'Which fast food chains do Americans love most?',
        category: 'food',
        questions: [
          { text: 'What is your favorite fast food chain?', type: 'multiple_choice', options: JSON.stringify(['Chick-fil-A', 'McDonald\'s', 'In-N-Out', 'Wendy\'s', 'Taco Bell', 'Five Guys']) },
          { text: 'How often do you eat fast food?', type: 'multiple_choice', options: JSON.stringify(['Never', '1-2 times/month', 'Weekly', '2-3 times/week', 'Daily']) },
          { text: 'Rate the overall quality of American fast food.', type: 'rating', options: null },
          { text: 'What fast food item could you eat every day?', type: 'text', options: null }
        ]
      },
      {
        title: 'Volunteering and Giving Back',
        description: 'How do Americans contribute to their communities?',
        category: 'community',
        questions: [
          { text: 'How often do you volunteer?', type: 'multiple_choice', options: JSON.stringify(['Weekly', 'Monthly', 'A few times a year', 'Once a year', 'Never']) },
          { text: 'What cause matters most to you?', type: 'multiple_choice', options: JSON.stringify(['Hunger/Food banks', 'Education', 'Environment', 'Animal welfare', 'Homelessness', 'Healthcare']) },
          { text: 'Rate how easy it is to find volunteer opportunities in your area.', type: 'rating', options: null },
          { text: 'What motivates you to volunteer or give back?', type: 'text', options: null }
        ]
      },
      {
        title: 'The American College Experience',
        description: 'Perspectives on higher education in the US.',
        category: 'general',
        questions: [
          { text: 'What is your highest level of education?', type: 'multiple_choice', options: JSON.stringify(['High school', 'Some college', 'Associate degree', 'Bachelor\'s degree', 'Master\'s or higher']) },
          { text: 'Do you have student loan debt?', type: 'multiple_choice', options: JSON.stringify(['No debt', 'Under $25k', '$25k-$50k', '$50k-$100k', '$100k+']) },
          { text: 'Rate the value of a college degree in today\'s economy.', type: 'rating', options: null },
          { text: 'What advice would you give to someone considering college?', type: 'text', options: null }
        ]
      },
      {
        title: 'Neighborhood Safety in America',
        description: 'How safe do Americans feel in their neighborhoods?',
        category: 'community',
        questions: [
          { text: 'How safe do you feel walking in your neighborhood at night?', type: 'rating', options: null },
          { text: 'What concerns you most about safety?', type: 'multiple_choice', options: JSON.stringify(['Property crime', 'Violent crime', 'Traffic safety', 'Poor lighting', 'Nothing, I feel safe']) },
          { text: 'Do you know your neighbors?', type: 'multiple_choice', options: JSON.stringify(['Yes, many of them', 'A few', 'Just one or two', 'None at all']) },
          { text: 'What would make your neighborhood feel safer?', type: 'text', options: null }
        ]
      },
      {
        title: 'American BBQ Showdown',
        description: 'Settle the great American BBQ debate once and for all.',
        category: 'food',
        questions: [
          { text: 'Which BBQ style is the best?', type: 'multiple_choice', options: JSON.stringify(['Texas brisket', 'Carolina pulled pork', 'Kansas City ribs', 'Memphis dry rub', 'Alabama white sauce']) },
          { text: 'How often do you grill or BBQ at home?', type: 'multiple_choice', options: JSON.stringify(['Weekly', 'A few times a month', 'Monthly', 'A few times a year', 'Never']) },
          { text: 'Rate your area\'s BBQ restaurant scene.', type: 'rating', options: null },
          { text: 'What is your secret grilling tip?', type: 'text', options: null }
        ]
      },
      {
        title: 'Work-Life Balance in America',
        description: 'Are Americans finding balance between work and life?',
        category: 'general',
        questions: [
          { text: 'How many hours per week do you work?', type: 'multiple_choice', options: JSON.stringify(['Under 30', '30-40', '40-50', '50-60', '60+']) },
          { text: 'How many vacation days do you take per year?', type: 'multiple_choice', options: JSON.stringify(['None', '1-5 days', '6-10 days', '11-15 days', '15+ days']) },
          { text: 'Rate your current work-life balance.', type: 'rating', options: null },
          { text: 'What would most improve your work-life balance?', type: 'text', options: null }
        ]
      },
      {
        title: 'The Future of American Cities',
        description: 'What should US cities look like in 10 years?',
        category: 'community',
        questions: [
          { text: 'What should cities prioritize most?', type: 'multiple_choice', options: JSON.stringify(['Affordable housing', 'Public transit', 'Green spaces', 'Walkability', 'Tech infrastructure']) },
          { text: 'Would you support more bike lanes over car lanes?', type: 'multiple_choice', options: JSON.stringify(['Strongly yes', 'Somewhat yes', 'Neutral', 'Somewhat no', 'Strongly no']) },
          { text: 'Rate your city\'s planning for the future.', type: 'rating', options: null },
          { text: 'What is one thing that would transform your city?', type: 'text', options: null }
        ]
      }
    ];

    const allSurveys = [...surveySeeds, ...usSurveySeeds];

    for (const survey of allSurveys) {
      const surveyResult = insertSurvey.run(
        survey.title, survey.description, survey.category
      );
      const surveyId = surveyResult.lastInsertRowid;

      for (let i = 0; i < survey.questions.length; i++) {
        const q = survey.questions[i];
        insertQuestion.run(surveyId, q.text, q.type, q.options, i + 1);
      }
    }
    console.log('Seeded 38 surveys with questions.');
  });

  seedTransaction();
  console.log('Database seeding complete.');
}

module.exports = { db, seedData };
