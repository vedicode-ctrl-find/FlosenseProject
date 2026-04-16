const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const EmployeeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false
    },
    role: {
        type: String,
        enum: ['Developer', 'Tester', 'Production', 'Designer', 'Data Scientist', 'DevOps', 'Product Manager'],
        required: [true, 'Please select a role']
    },
    skills: {
        type: [String],
        required: [true, 'Please add at least one skill']
    },
    company_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    employee_id: {
        type: String,
        unique: true
    },
    workload_percentage: {
        type: Number,
        default: 0
    },
    efficiency: {
        type: Number,
        default: 100 // Efficiency percentage (default 100%)
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

// Hash Password and generate Employee ID before Saving
EmployeeSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);

    // Generate Employee ID (e.g., EMP-1001) if not exists
    if (!this.employee_id) {
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        this.employee_id = `EMP-${randomDigits}`;
    }

    next();
});

// Match password
EmployeeSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Employee', EmployeeSchema);
