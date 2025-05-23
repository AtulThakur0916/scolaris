const models = require('../models');

module.exports.controller = function (app, passport, sendEmail, Op, sequelize) {

    // Allowed roles
    const allowedRoles = ["SuperAdmin", "School", "SubAdmin"];

    /**
     * Render view for managing parents
     */
    app.get('/parents/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (!allowedRoles.includes(req.user.role.name)) {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        try {
            let whereCondition = {};

            if (["School", "SubAdmin"].includes(req.user.role.name)) {
                const parentSchools = await models.ParentSchools.findAll({
                    attributes: ['parent_id'],
                    where: { school_id: req.user.school_id },
                    raw: true
                });

                const parentIds = parentSchools.map(ps => ps.parent_id);
                if (parentIds.length > 0) {
                    whereCondition.id = parentIds;
                } else {
                    whereCondition.id = null; // No parents for this school
                }
            }

            const parents = await models.Parents.findAll({
                attributes: ['id', 'name', 'email', 'mobile'],
                include: [
                    {
                        model: models.Schools,
                        as: 'schools',
                        attributes: ['name'],
                        through: { attributes: [] }
                    },
                    {
                        model: models.Students,
                        as: 'students',
                        attributes: ['name'],
                        through: { attributes: [] }
                    }
                ],
                where: whereCondition,
                order: [['name', 'ASC']],
                raw: true,
                nest: true
            });

            // Ensure schools and students are arrays
            parents.forEach(parent => {
                parent.schools = parent.schools ? [parent.schools] : [];
                parent.students = parent.students ? [parent.students] : [];
            });

            res.render('parents/index', {
                parents,
                messages: {
                    success: req.flash('success'),
                    error: req.flash('error')
                }
            });

        } catch (error) {
            console.error("Error fetching parents:", error);
            req.flash('error', 'Failed to load parents.');
            res.redirect('/');
        }
    });

    /**
     * Delete parent
     */
    app.delete('/parents/delete/:id', async (req, res) => {
        try {
            if (!req.isAuthenticated()) {
                return res.json({ success: false, message: 'Please login to continue' });
            }

            if (!allowedRoles.includes(req.user.role.name)) {
                return res.json({ success: false, message: "You are not authorized to access this page." });
            }

            const { id } = req.params;
            const parentData = await models.Parents.findOne({ where: { id } });

            if (!parentData) {
                return res.json({ success: false, message: 'Parent not found.' });
            }

            await models.Parents.destroy({ where: { id } });

            return res.json({ success: true, message: 'Parent deleted successfully.' });
        } catch (error) {
            console.error("Error deleting parent:", error);
            return res.json({ success: false, message: error.message });
        }
    });

};
