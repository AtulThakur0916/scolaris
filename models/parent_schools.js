module.exports = (sequelize, DataTypes) => {
    const ParentSchools = sequelize.define("ParentSchools", {
        parent_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: "Parents", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
        },
        school_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: "Schools", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
        }
    }, {
        tableName: "parent_schools",
        timestamps: false,
    });
    ParentSchools.associate = (models) => {
        ParentSchools.belongsTo(models.Schools, {
            foreignKey: 'school_id',
            as: 'school' // ✅ Match alias properly
        });

        ParentSchools.belongsTo(models.Parents, {
            foreignKey: 'parent_id',
            as: 'parent' // ✅ Define parent association as well
        });
    };

    return ParentSchools;
};
