'use strict';
module.exports = (sequelize, DataTypes) => {
    const Fees = sequelize.define('Fees', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        school_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'schools',
                key: 'id'
            }
        },
        class_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'classes',
                key: 'id'
            }
        },
        fee_type: {
            type: DataTypes.ENUM('Tuition', 'Transport', 'Cafeteria', 'Exam', 'Boarding', 'Events', 'Other'),
            allowNull: false
        },
        custom_fee_name: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        frequency: {
            type: DataTypes.ENUM('Monthly', 'Quarterly', 'Annually', 'One-Time'),
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        status: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            comment: '1 = Active, 0 = Inactive'
        }
    }, {
        freezeTableName: true,
        tableName: 'fees',
        underscored: true
    });

    Fees.associate = function (models) {
        Fees.belongsTo(models.Schools, { foreignKey: 'school_id', as: 'school' });
        Fees.belongsTo(models.Classes, { foreignKey: 'class_id', as: 'class' });
    };

    return Fees;
};
