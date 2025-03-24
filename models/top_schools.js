'use strict';

const { Model, UUIDV4 } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TopSchool extends Model {
        static associate(models) {
            // Relationship with Schools model
            TopSchool.belongsTo(models.Schools, {
                foreignKey: 'school_id',
                as: 'school'
            });
        }
    }

    TopSchool.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: UUIDV4,
            primaryKey: true
        },
        school_id: {
            type: DataTypes.UUID,
            allowNull: false
        }
    }, {
        sequelize,
        modelName: 'TopSchool',
        tableName: 'top_schools',
        underscored: true
    });

    return TopSchool;
};
