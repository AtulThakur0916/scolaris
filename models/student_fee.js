'use strict';
module.exports = (sequelize, DataTypes) => {
    const StudentFee = sequelize.define('StudentFee', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            allowNull: false,
            primaryKey: true
        },

        student_id: {
            type: DataTypes.UUID,
            allowNull: true
        },

        fee_id: {
            type: DataTypes.UUID,
            allowNull: true
        },

        assigned_date: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },

        due_date: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },

        custom_amount: {
            type: DataTypes.FLOAT,
            allowNull: true
        },
        frequency: {
            type: DataTypes.STRING,
            allowNull: true
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        tableName: 'student_fees',
        underscored: true,
        timestamps: true
    });

    StudentFee.associate = function (models) {
        StudentFee.belongsTo(models.Students, {
            foreignKey: 'student_id',
            as: 'student',
            onDelete: 'CASCADE'
        });
        StudentFee.hasMany(models.Payments, { foreignKey: 'student_fee_id', as: 'payments' });

        StudentFee.belongsTo(models.Fees, {
            foreignKey: 'fee_id',
            as: 'fee',
            onDelete: 'CASCADE'
        });
    };


    return StudentFee;
};
