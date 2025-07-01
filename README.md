# 📇 Daveenci CRM

A simple, clean CRM system built with **React**, **Node.js**, **Prisma**, and **PostgreSQL**, designed to track your contacts, touchpoints, and lead stages — hosted at [`crm.daveenci.ai`](https://crm.daveenci.ai).

---

## 🧭 Project Structure

```
/
├── server/          → Node.js backend (Express + Prisma)
│   ├── prisma/      → Prisma schema + migrations
│   └── src/         → API routes
├── src/             → React frontend (Create React App)
├── .env             → Root env (optional)
├── package.json     → Root scripts
└── README.md        → This file
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd daveenci-crm
npm run setup  # Installs all dependencies
```

### 2. Database Setup
```bash
# Create a PostgreSQL database
createdb daveenci_crm

# Configure your database URL in server/.env
DATABASE_URL="postgresql://username:password@localhost:5432/daveenci_crm?schema=public"
JWT_SECRET="your-super-secret-jwt-key"
PORT=4000
```

### 3. Run Database Migrations
```bash
cd server
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Create a Demo User (Optional)
```bash
# Start the server first
npm run dev

# Then create a user via API
curl -X POST http://localhost:4000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com", "password": "password123"}'
```

### 5. Start Development
```bash
npm run dev  # Runs both frontend and backend
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api
- Prisma Studio: `npx prisma studio` (from server/ directory)

---

## 📖 Available Scripts

### Root Level
- `npm run dev` - Run both frontend and backend concurrently
- `npm run setup` - Install all dependencies
- `npm run build` - Build both projects for production
- `npm run start:server` - Run only the backend
- `npm run start:frontend` - Run only the frontend

### Backend (server/)
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production server
- `npx prisma studio` - Open Prisma Studio (database GUI)
- `npx prisma migrate dev` - Run database migrations

### Frontend (src/)
- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests

---

## 🗃️ Database Schema

### Models
- **User** - CRM users/team members
- **Contact** - Customer/prospect records
- **Touchpoint** - Interaction history with contacts
- **Status** - Lead stages (PROSPECT → LEAD → OPPORTUNITY → CLIENT)

### Key Features
- Contact management with search and filtering
- Status-based lead pipeline tracking  
- Touchpoint logging for interaction history
- User assignment and ownership
- Clean, modern UI with responsive design

---

## 🌐 API Endpoints

### Contacts
- `GET /api/contacts` - List all contacts
- `GET /api/contacts/:id` - Get contact details
- `POST /api/contacts` - Create new contact
- `PUT /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact

### Touchpoints
- `POST /api/contacts/:id/touchpoints` - Add touchpoint to contact

### Users
- `GET /api/users` - List users
- `POST /api/users` - Create user

### Health
- `GET /api/health` - API health check

---

## 🎨 Tech Stack

### Frontend
- **React 18** with TypeScript
- **CSS3** with modern styling (no framework dependencies)
- **Axios** for API calls
- **React Router** for navigation

### Backend  
- **Node.js** with Express
- **TypeScript** for type safety
- **Prisma ORM** for database management
- **PostgreSQL** as primary database
- **CORS** enabled for cross-origin requests

### Development
- **Concurrently** for running multiple processes
- **Nodemon** for backend hot reload
- **ts-node** for TypeScript execution

---

## 🔧 Environment Variables

Create a `server/.env` file:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/daveenci_crm?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
PORT=4000
```

---

## 🚢 Deployment

### Frontend (Vercel/Netlify)
```bash
cd src
npm run build
# Deploy the 'build' folder
```

### Backend (Render/Railway)
```bash
cd server
npm run build
# Deploy with start command: "npm start"
```

### Database
- **Neon.tech** - Serverless PostgreSQL
- **Render PostgreSQL** - Managed database
- **Supabase** - PostgreSQL with additional features

---

## 📝 Development Notes

### Adding New Features
1. **Database changes**: Update `server/prisma/schema.prisma`
2. **API routes**: Add to `server/src/index.ts`
3. **Frontend components**: Update `src/src/App.tsx`
4. **Styling**: Modify `src/src/App.css`

### Code Structure
- Backend follows RESTful API conventions
- Frontend uses functional components with hooks
- TypeScript interfaces for type safety
- Error handling and loading states included

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ by the Daveenci team**