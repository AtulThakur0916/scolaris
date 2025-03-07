'use strict';
module.exports = (sequelize, DataTypes) => {
    const SchoolSessions = sequelize.define('SchoolSessions', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        school_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        start_date: {
            type: DataTypes.DATE,
            allowNull: false
        },
        end_date: {
            type: DataTypes.DATE,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('Active', 'Completed'),
            allowNull: false,
            defaultValue: 'Active'
        }
    }, {
        freezeTableName: true,
        tableName: 'school_sessions',
        underscored: true
    });

    SchoolSessions.associate = function (models) {
        SchoolSessions.belongsTo(models.Schools, {
            foreignKey: 'school_id',
            as: 'school'
        });
    };

    return SchoolSessions;
};
