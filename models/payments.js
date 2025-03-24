'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class Payments extends Model {
        static associate(models) {
            Payments.belongsTo(models.Parents, { foreignKey: 'parent_id', as: 'parent' });
            Payments.belongsTo(models.Students, { foreignKey: 'student_id', as: 'student' });
            Payments.belongsTo(models.Fees, { foreignKey: 'fee_id', as: 'fee' });
        }
    }

    Payments.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            parent_id: {
                type: DataTypes.UUID,
                allowNull: true,
            },
            student_id: {
                type: DataTypes.UUID,
                allowNull: true,
            },
            fee_id: {
                type: DataTypes.UUID,
                allowNull: true,
            },
            amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
            },
            payment_date: {
                type: DataTypes.DATE,
                allowNull: true,
                defaultValue: DataTypes.NOW,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            status: {
                type: DataTypes.ENUM('pending', 'completed', 'failed'),
                allowNull: true,
                defaultValue: 'pending',
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
        },
        {
            sequelize,
            modelName: 'Payments',
            tableName: 'payments',
            underscored: true,
        }
    );

    return Payments;
};
