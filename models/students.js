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
            type: DataTypes.STRING,  // ✅ Changed from INTEGER to STRING
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
        roll_number: {
            type: DataTypes.STRING,  // ✅ Changed from INTEGER to STRING
            allowNull: true,         // ✅ Allow NULL values
            unique: false
        },
        status: {
            type: DataTypes.BOOLEAN, // ✅ Changed from INTEGER to BOOLEAN
            defaultValue: true,      // ✅ Default is true (active)
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
