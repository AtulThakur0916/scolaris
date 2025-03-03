const bcrypt = require('bcryptjs');
const { Users } = require('../../models');
// const { Users } = require('../../models/users');

const msg = async (req, res) => {
    res.json({
        status: 200,
        message: "Successfully retrieved",
        data: [
            { msg: "Hello Developer" }
        ]
    });
};

const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if the user exists
        const user = await Users.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({
                status: 401,
                message: 'Authentication failed. User not found.',
            });
        }

        // Compare the provided password with the hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                status: 401,
                message: 'Authentication failed. Wrong password.',
            });
        }

        // Authentication successful
        return res.status(200).json({
            status: 200,
            message: 'Successfully logged in.',
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                // Include other user details as needed
            },
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            message: 'An error occurred during authentication.',
            error: error.message,
        });
    }
};

module.exports = {
    msg,
    login
};
