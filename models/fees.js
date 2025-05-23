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
        fees_type_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'fees_types',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
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
        },
        school_sessions_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'school_sessions',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
    }, {
        freezeTableName: true,
        tableName: 'fees',
        underscored: true
    });

    Fees.associate = function (models) {
        Fees.belongsTo(models.Schools, { foreignKey: 'school_id', as: 'school' });
        Fees.belongsTo(models.Classes, { foreignKey: 'class_id', as: 'class' });
        Fees.belongsTo(models.SchoolSessions, { foreignKey: 'school_sessions_id', as: 'session' });
        Fees.belongsTo(models.FeesTypes, { foreignKey: 'fees_type_id', as: 'feesType' }); // ✅ Added association
    };

    return Fees;
};
