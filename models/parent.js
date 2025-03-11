module.exports = (sequelize, DataTypes) => {
    const Parents = sequelize.define('Parents', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        mobile: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        otp: {
            type: DataTypes.STRING,
            allowNull: true
        },
        otp_verified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        freezeTableName: true,
        tableName: 'parents',
        underscored: true
    });

    Parents.associate = function (models) {
        // console.log(models); // Debugging: Check if models.School and models.Student exist

        if (models.Schools) {
            Parents.belongsToMany(models.Schools, {
                through: 'ParentSchools',
                foreignKey: 'parent_id',
                otherKey: 'school_id'
            });
        } else {
            console.error("School model not found in associations");
        }

        if (models.Students) {
            Parents.belongsToMany(models.Students, {
                through: 'ParentStudents',
                foreignKey: 'parent_id',
                otherKey: 'student_id'
            });
        } else {
            console.error("Student model not found in associations");
        }
    };

    return Parents;
};
