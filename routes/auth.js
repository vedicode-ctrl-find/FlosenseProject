const express = require('express');
const router = express.Router();
const { 
    signup, login, 
    employeeSignup, employeeLogin, 
    updateProfile, getProfile,
    getSkillSuggestions
} = require('../controllers/authController');

// Basic auth routes
router.post('/signup', signup);
router.post('/login', login);
router.post('/employee/signup', employeeSignup);
router.post('/employee/login', employeeLogin);

// Profile sync routes (Persistent DB connection)
router.get('/profile/:id/:role', getProfile);
router.put('/profile', updateProfile);
router.get('/skills/:role', getSkillSuggestions);

module.exports = router;
