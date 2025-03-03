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
            allowNull: false,
            // unique: true,
            validate: {
                isEmail: true
            }
        },
        age: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 3 // Ensuring a reasonable age limit
            }
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
            allowNull: false,
            references: {
                model: 'classes',
                key: 'id'
            }
        },
        status: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: '0 = Inactive, 1 = Active'
        }
    }, {
        freezeTableName: true,
        tableName: 'students',
        underscored: true
    });

    Students.associate = function (models) {
        Students.belongsTo(models.Schools, { foreignKey: 'school_id', as: 'school' });
        Students.belongsTo(models.Classes, { foreignKey: 'class_id', as: 'class' });
    };

    return Students;
};
