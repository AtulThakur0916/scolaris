'use strict';

module.exports = (sequelize, DataTypes) => {
    const Students = sequelize.define('Students', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {
                isEmail: true
            }
        },
        age: {
            type: DataTypes.STRING,
            allowNull: true
        },
        school_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'schools',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        class_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'classes',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
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
        roll_number: {
            type: DataTypes.STRING,
            allowNull: true
        },
        state: {
            type: DataTypes.STRING,
            allowNull: true
        },
        city: {
            type: DataTypes.STRING,
            allowNull: true
        },
        country: {
            type: DataTypes.STRING,
            allowNull: true
        },
        address: {
            type: DataTypes.STRING,
            allowNull: true
        },
        status: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: 'false = Inactive, true = Active'
        }
    }, {
        freezeTableName: true,
        tableName: 'students',
        underscored: true
    });

    // 🔹 Define associations
    Students.associate = function (models) {
        Students.belongsTo(models.Schools, { foreignKey: 'school_id', as: 'school' });
        Students.belongsTo(models.Classes, { foreignKey: 'class_id', as: 'class' });
    };

    return Students;
};
