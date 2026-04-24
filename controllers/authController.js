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
        console.error('SIGNUP ERROR:', error);
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
        console.error('LOGIN ERROR:', error);
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
        console.error('EMPLOYEE SIGNUP ERROR:', error);
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
                company_id: employee.company_id._id,   // ← Added so frontend can store companyId
                role: 'employee'
            }
        });
    } catch (error) {
        console.error('EMPLOYEE LOGIN ERROR:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
};

// @desc    Update user profile (Persistent)
// @route   PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
    try {
        const { id, role, name, email, password, profile_image, role_field, skills } = req.body;
        let user;

        if (role === 'company') {
            user = await Company.findById(id);
            if (name) user.company_name = name;
        } else {
            user = await Employee.findById(id);
            if (name) user.name = name;
            
            // Professional fields
            console.log('UPDATING EMPLOYEE:', { role_field, skills });
            if (role_field) user.role = role_field;
            if (skills !== undefined) {
                user.skills = typeof skills === 'string' ? skills.split(',').map(s => s.trim()).filter(s => s !== "") : skills;
            }
        }

        if (!user) {
            return res.status(404).json({ success: false, message: 'Identity not found in database.' });
        }

        if (email) user.email = email;
        if (password) user.password = password; // Pre-save hook will hash it
        if (profile_image !== undefined) user.profile_image = profile_image;

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Central database synchronized successfully.',
            data: {
                name: role === 'company' ? user.company_name : user.name,
                email: user.email,
                profile_image: user.profile_image,
                role: user.role, // The actual role field
                skills: user.skills
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get user profile
// @route   GET /api/auth/profile/:id/:role
exports.getProfile = async (req, res) => {
    try {
        const { id, role } = req.params;
        let user;

        if (role === 'company') {
            user = await Company.findById(id);
        } else {
            user = await Employee.findById(id);
        }

        if (!user) {
            return res.status(404).json({ success: false, message: 'Identity not found.' });
        }

        res.status(200).json({
            success: true,
            data: {
                name: role === 'company' ? user.company_name : user.name,
                email: user.email,
                profile_image: user.profile_image,
                display_role: role === 'company' ? 'Company Lead' : user.role,
                skills: role === 'employee' ? user.skills : [],
                role: role,
                billing: role === 'company' ? user.billing : null
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getSkillSuggestions = async (req, res) => {
    try {
        const { role } = req.params;
        const roleSuggestions = {
            'Developer': ['React', 'Node.js', 'Python', 'JavaScript', 'MongoDB', 'Docker', 'Git', 'TypeScript', 'Tailwind CSS', 'Redux'],
            'Tester': ['Selenium', 'Jest', 'Cypress', 'Manual Testing', 'API Testing', 'Performance Testing', 'Postman', 'JUnit', 'Appium'],
            'Designer': ['UI Design', 'UX Research', 'Figma', 'Adobe XD', 'Prototyping', 'Design Systems', 'Typography', 'Illustrator', 'Blender'],
            'Data Scientist': ['Machine Learning', 'Python', 'R', 'SQL', 'Data Visualization', 'Statistics', 'Pandas', 'TensorFlow', 'Scikit-Learn'],
            'DevOps': ['Terraform', 'Kubernetes', 'CI/CD', 'Azure', 'GCP', 'Monitoring', 'Bash Scripting', 'Security', 'Docker', 'Jenkins'],
            'Product Manager': ['Roadmapping', 'User Stories', 'Market Research', 'Agile', 'Analytics', 'Stakeholder Mgmt', 'Jira', 'Confluence'],
            'Production': ['Agile', 'Kanban', 'Project Management', 'AWS', 'CI/CD', 'Documentation', 'Jira', 'Scrum', 'Lean']
        };

        const suggestions = roleSuggestions[role] || [];
        res.status(200).json({ success: true, data: suggestions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
