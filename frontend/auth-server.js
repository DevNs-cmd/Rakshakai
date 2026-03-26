const express = require('express');
const session = require('express-session');
const { google } = require('googleapis');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Use CORS to allow Next.js app on port 3000 to interact
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));

/**
 * Configure express-session for state security
 */
app.use(session({
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true in prod with HTTPS
}));

/**
 * Google OAuth2 Configuration
 * Uses placeholder credentials if not provided in environment variables.
 */
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || 'dummy_client_id_for_rakshak',
    process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret',
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback'
);

// Access scopes for two non-Sign-In scopes: Read-only Drive activity and Google Calendar.
// Added email/profile for standard signup authentication.
const scopes = [
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
];

/**
 * Endpoint to initiate Google Sign-Up / Login
 */
app.get('/auth/google', (req, res) => {
    // Generate a secure random state value.
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in the session
    req.session.state = state;

    // Generate a url that asks permissions for the Drive activity and Google Calendar scope
    const authorizationUrl = oauth2Client.generateAuthUrl({
        // 'online' (default) or 'offline' (gets refresh_token)
        access_type: 'offline',
        /** Pass in the scopes array defined above.
          * Alternatively, if only one scope is needed, you can pass a scope URL as a string */
        scope: scopes,
        // Enable incremental authorization. Recommended as a best practice.
        include_granted_scopes: true,
        // Include the state parameter to reduce the risk of CSRF attacks.
        state: state
    });

    res.redirect(authorizationUrl);
});

/**
 * Endpoint for Google OAuth Callback
 */
app.get('/auth/google/callback', async (req, res) => {
    const { code, state } = req.query;

    // CSRF Check
    if (state !== req.session.state) {
        return res.status(403).send('State mismatch. Possible CSRF attack.');
    }

    try {
        // If dummy credentials are used, we mock the success for demonstration
        if (oauth2Client._clientId === 'dummy_client_id_for_rakshak') {
             console.log("Mocking Google OAuth success due to missing real client ID.");
             return res.redirect('http://localhost:3000/dashboard?google_auth=success');
        }

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Fetch User Info to complete "Signup" logic
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        
        console.log("Google Signup Success User:", userInfo.data);

        // Successfully authenticated, redirect back to Next.js platform
        res.redirect('http://localhost:3000/dashboard?google_auth=success');
    } catch (error) {
        console.error('Error retrieving access token', error);
        res.status(500).send('Authentication Error');
    }
});

app.listen(PORT, () => {
    console.log(`[Google Auth Server] Dynamic Integrated Auth Server running at http://localhost:${PORT}`);
});
