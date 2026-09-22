const express = require('express');
const cors = require('cors');
require('dotenv').config();
const dashboardRoutes = require('./routes/dashboardRoutes');
const  path = require('path');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const masterlistRoutes = require('./routes/masterlistRoutes') 
const scheduleRoutes = require('./routes/scheduleRoutes')
const profileRoutes = require('./routes/profileRoutes')
const notificationRoutes = require('./routes/notificationRoutes');


const bhwDashboardRoutes = require('./routes/bhwDashboardRoutes');
const bhwScheduleRoutes = require('./routes/bhwScheduleRoutes');
const bhwNeedAttentionRoutes = require('./routes/bhwNeedAttentionRoutes');
const bhwReferralsRoutes = require('./routes/bhwReferralsRoutes');
const bhwMedicalRecordsRoutes = require('./routes/bhwMedicalRecordsRoutes');
const bhwNotificationRoutes = require('./routes/bhwNotificationRoutes');
const bhwProfileRoutes = require('./routes/bhwProfileRoutes');
const mobileBeneficiaryRoutes = require('./routes/mobileBeneficiaryRoutes');

const app = express();

// security middleware
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Disable Helmet's CORP so we can explicitly control it for /uploads
// Intercept header sets for uploads to ensure CORP remains 'cross-origin'
app.use((req, res, next) => {
    if (String(req.path || '').startsWith('/uploads')) {
        const originalSet = res.setHeader.bind(res);
        res.setHeader = (name, value) => {
            if (String(name).toLowerCase() === 'cross-origin-resource-policy') {
                return originalSet('Cross-Origin-Resource-Policy', 'cross-origin');
            }
            return originalSet(name, value);
        };
    }
    next();
});

app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            imgSrc: ["'self'", 'http://localhost:5000', 'data:'],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
            connectSrc: ["'self'", 'http://localhost:5000'],
        }
    }
}));
app.use(cors({ origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : true }));
app.use(express.json());

// simple request logger for debugging incoming API calls
app.use((req, res, next) => {
    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        const masked = authHeader ? `${String(authHeader).slice(0, 12)}...` : null;
        console.log('Incoming request:', req.method, req.originalUrl, 'AuthPresent:', !!authHeader, 'AuthHeader:', masked);
    } catch (e) {
        console.error('Request logger failed', e && e.message);
    }
    next();
});

// basic rate limiter for all requests
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 120, // limit each IP to 120 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

//sa routes
// Public/auth routes
app.use('/api/auth', authRoutes);

// JWT middleware will protect routes below (added dynamically)
const jwtMiddleware = require('./middleware/jwtMiddleware');

app.use('/api', jwtMiddleware); // protect all /api/* except /api/auth

app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/masterlist', masterlistRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationRoutes);


app.use('/api/bhw', bhwDashboardRoutes);
app.use('/api/bhw/schedule' , bhwScheduleRoutes);
app.use('/api/bhw/need-attention', bhwNeedAttentionRoutes);
app.use('/api/bhw/referrals', bhwReferralsRoutes);
app.use('/api/bhw/medical-records', bhwMedicalRecordsRoutes);
app.use('/api/bhw/notification', bhwNotificationRoutes);
app.use('/api/bhw/profile', bhwProfileRoutes);
app.use('/api/mobile', mobileBeneficiaryRoutes);

// Serve uploads with explicit headers to allow cross-origin image usage from frontend
// Ensure uploads responses include CORP and CORS headers before static serving
app.use('/uploads', (req, res, next) => {
    // remove any previous CORP header (helmet or other middleware may set it)
    try { res.removeHeader && res.removeHeader('Cross-Origin-Resource-Policy'); } catch (e) {}
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // allow requests from frontend during development; if CORS_ORIGINS set, echo it
    const origins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:5174'];
    const origin = req.headers.origin;
    if (origin && origins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, filePath) => {
        // redundant guard: set again in case other middleware modifies headers
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
}));
// check 
app.get('/', (req, res)=>{
    res.send('AppScale Backend API is running.');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// global error handler (catch unhandled async errors)
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err && (err.stack || err));
    res.status(500).json({ message: 'Server error. Please try again later' });
});