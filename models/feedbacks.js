'use strict';

module.exports = (sequelize, DataTypes) => {
    const Feedback = sequelize.define(
        'Feedback',
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            parent_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'Parents',
                    key: 'id'
                }
            },
            loving_point: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: {
                    min: 1,
                    max: 5
                }
            },
            experience: {
                type: DataTypes.TEXT,
                allowNull: true
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
        },
        {
            tableName: 'feedbacks',
            timestamps: true,
            underscored: true
        }
    );

    Feedback.associate = function (models) {
        Feedback.belongsTo(models.Parents, { foreignKey: 'parent_id', as: 'parent' });
    };

    return Feedback;
};
