module.exports = (sequelize, DataTypes) => {
    const ParentStudents = sequelize.define("ParentStudents", {
        parent_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: "Parents", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
        },
        student_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: "Students", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
        },
        relations: {
            type: DataTypes.STRING,
            allowNull: true,
        }
    }, {
        tableName: "parent_students",
        timestamps: false,
    });
    ParentStudents.associate = (models) => {
        ParentStudents.belongsTo(models.Students, {
            foreignKey: 'student_id',
            as: 'Student' // Alias for fetching school details
        });
    };
    return ParentStudents;
};
