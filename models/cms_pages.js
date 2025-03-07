'use strict';
module.exports = (sequelize, DataTypes) => {
    const CMSPage = sequelize.define('CMSPage', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            comment: 'Primary Key (UUID)'
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        slug: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('0', '1'),
            allowNull: false,
            defaultValue: '1',
            comment: '0 = Inactive, 1 = Active'
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {
        freezeTableName: true,
        tableName: 'cms_pages',
        underscored: true
    });

    return CMSPage;
};
