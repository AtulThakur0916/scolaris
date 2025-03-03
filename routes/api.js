
const express = require('express')
const userController = require('../controllers/Api/userController')
const { msg, login } = userController
const router = express.Router()
router.use(express.json());

//route
router.get('/msg', msg);
router.post('/login', login);

module.exports = router