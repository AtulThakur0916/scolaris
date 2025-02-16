const fs = require("fs").promises;
const path = require("path");

const paymentEmail = async () => {

    const templatePath = path.join(__dirname, '/payment.html');
    console.log('templatePath', templatePath);
    const templateFile = await fs.readFile(templatePath, 'utf-8');
    return templateFile;    
}

export {paymentEmail}