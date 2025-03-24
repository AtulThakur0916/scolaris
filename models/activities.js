'use strict';

module.exports = (sequelize, DataTypes) => {
    const Activity = sequelize.define('Activity', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        title: {
            type: DataTypes.STRING,
            allowNull: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        school_id: {
            type: DataTypes.UUID,
            allowNull: true
        },
        status: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            comment: '0 = Inactive, 1 = Active'
        }
    }, {
        freezeTableName: true,
        tableName: 'activities',
        underscored: true,
        timestamps: true
    });
    Activity.associate = function (models) {
        Activity.belongsTo(models.Schools, {
            foreignKey: 'school_id',
            as: 'school'
        });
    };

    return Activity;
};
