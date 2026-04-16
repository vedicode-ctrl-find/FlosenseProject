const Company = require('../models/Company');
const Employee = require('../models/Employee');
const jwt = require('jsonwebtoken');

// @desc    Register a new company
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res) => {
    try {
        const { company_name, email, password, confirmPassword, industry } = req.body;

        // Validation
        if (!company_name || !email || !password || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Passwords do not match.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        }

        // Check for existing company
        const companyExists = await Company.findOne({ email });
        if (companyExists) {
            return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
        }

        // Create company
        const company = await Company.create({
            company_name,
            email,
            password,
            industry: industry || 'Technology'
        });

        if (company) {
            res.status(201).json({
                success: true,
                message: 'Company registered successfully!',
                data: {
                    id: company._id,
                    company_name: company.company_name,
                    email: company.email,
                    company_code: company.company_code,
                    industry: company.industry
                }
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
};

// @desc    Login company
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const { email, password, company_code } = req.body;

        // Validation
        if (!email || !password || !company_code) {
            return res.status(400).json({ success: false, message: 'Please provide email, password, and company code.' });
        }

        // Check for company
        const company = await Company.findOne({ email, company_code }).select('+password');
        if (!company) {
            return res.status(401).json({ success: false, message: 'Invalid email, password, or company code.' });
        }

        // Check password
        const isMatch = await company.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email, password, or company code.' });
        }

        // Generate token
        const token = jwt.sign({ id: company._id }, process.env.JWT_SECRET, {
            expiresIn: '30d'
        });

        res.status(200).json({
            success: true,
            token,
            data: {
                id: company._id,
                company_name: company.company_name,
                company_code: company.company_code,
                role: 'company'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
};

// @desc    Register a new employee
// @route   POST /api/auth/employee/signup
// @access  Public
exports.employeeSignup = async (req, res) => {
    try {
        const { name, email, password, company_name, role, skills } = req.body;

        // Validation
        if (!name || !email || !password || !company_name || !role || !skills) {
            return res.status(400).json({ success: false, message: 'Please fill in all required fields including company name.' });
        }

        // Verify Company Name (Case-insensitive check)
        const company = await Company.findOne({ 
            company_name: { $regex: new RegExp("^" + company_name + "$", "i") } 
        });
        
        if (!company) {
            return res.status(400).json({ success: false, message: 'Company not found. Please ensure the company name is correct.' });
        }

        // Check for existing employee
        const employeeExists = await Employee.findOne({ email });
        if (employeeExists) {
            return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
        }

        // Process skills (convert string to array if needed)
        const skillsArray = typeof skills === 'string' ? skills.split(',').map(s => s.trim()) : skills;

        // Create employee
        const employee = await Employee.create({
            name,
            email,
            password,
            role,
            skills: skillsArray,
            company_id: company._id
        });

        res.status(201).json({
            success: true,
            message: 'Registration successful! You have joined ' + company.company_name,
            data: {
                id: employee._id,
                name: employee.name,
                employee_id: employee.employee_id,
                company: company.company_name
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
};

// @desc    Login employee
// @route   POST /api/auth/employee/login
// @access  Public
exports.employeeLogin = async (req, res) => {
    try {
        const { email, password, company_code } = req.body;

        if (!email || !password || !company_code) {
            return res.status(400).json({ success: false, message: 'Please provide email, password, and company code.' });
        }

        const employee = await Employee.findOne({ email }).select('+password').populate('company_id');
        
        if (!employee) {
            return res.status(401).json({ success: false, message: 'Invalid email, password, or company code.' });
        }

        // Verify Company Code matches the employee's company
        if (employee.company_id.company_code !== company_code) {
            return res.status(401).json({ success: false, message: 'Invalid email, password, or company code.' });
        }

        const isMatch = await employee.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email, password, or company code.' });
        }

        const token = jwt.sign({ id: employee._id, role: 'employee' }, process.env.JWT_SECRET, {
            expiresIn: '30d'
        });

        res.status(200).json({
            success: true,
            token,
            data: {
                id: employee._id,
                name: employee.name,
                employee_id: employee.employee_id,
                company_name: employee.company_id.company_name,
                role: 'employee'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
};
