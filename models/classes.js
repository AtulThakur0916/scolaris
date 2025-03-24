'use strict';
module.exports = (sequelize, DataTypes) => {
    const Classes = sequelize.define('Classes', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        school_id: {
            type: DataTypes.UUID,
            allowNull: false
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
        status: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            comment: '0 = Inactive, 1 = Active'
        }
    }, {
        freezeTableName: true,
        tableName: 'classes',
        underscored: true
    });

    Classes.associate = function (models) {
        Classes.belongsTo(models.Schools, {
            foreignKey: 'school_id',
            as: 'school'
        });
    };


    return Classes;
};
