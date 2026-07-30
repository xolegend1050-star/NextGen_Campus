# NextGen Campus

A comprehensive platform connecting tier 2/3 city students with alumni mentorship, doubt-solving, and micro-internships.

## 🚀 Features

### Core Modules
1. **Authentication & Role Management** - Multi-role system (Student, Alumni, Company, Admin)
2. **Tiered Verification** - Two-tier verification system (Auto & Manual)
3. **Student Profile & Portfolio** - Complete profile with skills, experience, projects
4. **Peer & AI Doubt-Solving Forum** - AI-powered instant answers + peer support
5. **AI Mentor Matching & Booking** - Smart matching based on skills and goals
6. **Chat & Video Communication** - Real-time messaging with file sharing
7. **Gig & Micro-Internship Posting** - Companies post beginner-friendly gigs
8. **AI Gig Recommendation** - Personalized gig suggestions with success prediction
9. **Escrow Wallet & Payment** - Secure payment system with dispute resolution
10. **Rating, Reputation & Trust Score** - Gamified reputation system
11. **Notification System** - Multi-channel notifications
12. **Admin Dashboard & Access Control** - Comprehensive admin tools
13. **Analytics Dashboard** - Platform and user analytics
14. **Resource Library & AI Interview Prep** - Learning resources and mock interviews
15. **Gamification (Badges & Points)** - Achievement system
16. **REST API & Web Services** - Well-documented API

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React + Vite + Tailwind CSS | User interface |
| Backend | Node.js + Express | Core business logic |
| AI/ML | Python + Flask + scikit-learn | Prediction models |
| Database | PostgreSQL (Supabase) | Data storage |
| Auth/Storage | Supabase | Authentication, file storage |
| AI Features | Google Gemini API | Instant answers, moderation |

## 📁 Project Structure

```
NextGen_Campus/
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── context/       # React context providers
│   │   ├── services/      # API services
│   │   ├── store/         # Zustand state management
│   │   └── utils/         # Utility functions
│   └── ...
├── backend/                # Node.js backend
│   ├── src/
│   │   ├── controllers/   # Route handlers
│   │   ├── models/        # Database models
│   │   ├── routes/        # API routes
│   │   ├── middleware/     # Custom middleware
│   │   ├── services/      # Business logic
│   │   ├── validators/    # Input validation
│   │   └── utils/         # Utility functions
│   └── ...
├── ai-service/             # Python AI/ML service
│   ├── models/            # ML models
│   ├── routes/            # Flask routes
│   └── utils/             # Utility functions
└── docs/                   # Documentation
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- PostgreSQL (or Supabase account)
- Redis (optional, for caching)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-username/nextgen-campus.git
cd nextgen-campus
```

2. **Setup Backend**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

3. **Setup Frontend**
```bash
cd frontend
npm install
npm run dev
```

4. **Setup AI Service**
```bash
cd ai-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

5. **Database Setup**
```bash
# Run the SQL file in your PostgreSQL database
# Or use Supabase dashboard to import
psql -f backend/src/config/database.sql
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database
DATABASE_URL=postgresql://...

# Supabase
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...

# JWT
JWT_SECRET=your-secret-key

# AI Service
GEMINI_API_KEY=your-gemini-key
```

## 📚 API Documentation

Once the backend is running, visit:
- Swagger UI: http://localhost:5000/api-docs

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend build test
cd frontend
npm run build
```

## 🚢 Deployment

### Vercel (Frontend)
```bash
cd frontend
vercel deploy
```

### Render (Backend)
- Connect your GitHub repository
- Set environment variables
- Deploy

### Supabase (Database)
- Create a new project
- Run the database.sql file
- Get connection details

## 📊 Database Schema

The complete PostgreSQL schema includes:
- 25+ tables
- UUID primary keys
- Proper foreign key relationships
- Indexes for performance
- Triggers for automation
- Audit logging

## 🔐 Security Features

- Password hashing with bcrypt
- JWT authentication with refresh tokens
- Rate limiting
- Input validation
- CORS configuration
- Role-based access control
- Audit logging

## 🤖 AI/ML Features

- Doubt answer generation (Gemini API)
- Content moderation
- Mentor recommendation
- Gig recommendation
- Success prediction
- Dropout prediction
- Payment risk assessment

## 👥 User Roles

| Role | Permissions |
|------|------------|
| Student | Ask doubts, apply for gigs, book mentors |
| Alumni/Mentor | Answer doubts, provide mentorship |
| Company | Post gigs, hire students |
| Admin | Manage users, verify, resolve disputes |

## 📈 Trust Score System

- Doubt activity: +2 points per question
- Answer accepted: +5 points
- Mentorship session: +3 points
- Gig completed: +5 points
- 5-star rating: +3 points

**Tiers:**
- New: 0-29 points
- Rising: 30-69 points
- Featured: 70+ points

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

**Sujal Borhade**
- College: Thakur College of Science and Commerce, Mumbai
- Program: B.Sc. Computer Science
- Academic Year: 2025-2026

## 🙏 Acknowledgments

- Inspired by LinkedIn, Chegg, Internshala, Upwork
- Built for tier 2/3 city students
- Aligned with NEP 2020 goals
