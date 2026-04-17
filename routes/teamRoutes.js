/**
 * routes/teamRoutes.js
 *
 * GET /api/team-members
 *   Secure token-authenticated endpoint.
 *   Server derives companyId from the JWT — frontend CANNOT manipulate it.
 *   Returns only employees belonging to the same company as the requester.
 *
 * Logic:
 *   - If role = 'employee' → look up employee → use their company_id
 *   - If company admin    → their own id IS the company_id
 *
 * Security guarantee:
 *   Employees from Company A can NEVER see employees from Company B,
 *   because the filter is driven entirely by the server-validated JWT.
 */

const express  = require('express');
const router   = express.Router();
const Employee = require('../models/Employee');
const protect  = require('../middleware/auth');

// @route   GET /api/team-members
// @desc    Get all employees of the same company as the authenticated user
// @access  Private (requires valid JWT)
router.get('/', protect, async (req, res) => {
    try {
        const { id, role } = req.user;

        let companyId;

        if (role === 'employee') {
            // Employee token: id = employee._id
            // Look up the employee to get their company_id
            const self = await Employee.findById(id).select('company_id');
            if (!self) {
                return res.status(404).json({ success: false, error: 'Employee record not found.' });
            }
            companyId = self.company_id;
        } else {
            // Company admin token: id = company._id  (which is the company_id on Employee docs)
            companyId = id;
        }

        // Fetch all employees with that company_id (server-side filter — cannot be bypassed)
        const employees = await Employee.find({ company_id: companyId })
            .select('name role skills workload_percentage efficiency employee_id created_at')
            .sort({ created_at: 1 });   // Oldest member first

        res.json({
            success: true,
            count:   employees.length,
            data:    employees
        });

    } catch (err) {
        console.error('[/api/team-members] Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
