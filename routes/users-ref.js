var express = require("express");
var os = require('os');
var EmpMstModel = require("../schema/emp_master");
var LeaveMstModel = require("../schema/leave_master");
var HolidayMstModel = require("../schema/holiday_master");
var AttendanceModel = require("../schema/attendance");
var LogModel = require("../schema/login");
var moment = require('moment');
// var climate = require('city-weather');
const { ObjectId } = require("mongodb");
var pincode = require('pincode');
const res = require("express/lib/response");
const { request } = require("http");
const urls = require('url');
const { url } = require("inspector");
const { stat } = require("fs");
var router = express.Router();
var ObjectID = require('mongodb').ObjectID;
var authMiddleware = require("../routes/middleware/auth");  //added on 13-9-24
const { Console } = require("console");
const bcrypt = require('bcrypt');

/* GET index page */
router.get("/", authMiddleware, function (req, res, next) {
  res.render("index", { title: "Introduction page", userId: req.session.userId });

});

//Get Employees page
router.get("/employees", authMiddleware, function (req, res, next) {
  res.render("employees", { title: "Employees page", userId: req.session.userId })
});
//Add new employee
router.post("/addemp/", authMiddleware, async (req, res) => {
  const str = req.body.empname;
  const rest = str.toUpperCase();

  try {
    const result = await EmpMstModel.find({ emp_name: req.body.empname }).countDocuments().exec();
    console.log('Total count::::', result);

    if (result > 0) {
      console.log('Duplicate');
      res.render("hi", { title: "Duplicate record", userId: req.session.userId });
    } else {
      const empData = {
        emp_name: rest,
        year_of_joining: req.body.joinyr,
        gender: req.body.cmbGender,
        mob: req.body.txtmob,
        remarks: req.body.rmrk
      };

      var data = new EmpMstModel(empData);
      await data.save();

      const empList = await EmpMstModel.find().sort({ emp_name: 1 }).exec();
      res.redirect('../emplist');
    }
  } catch (err) {
    console.log('Error:', err);
    res.status(500).send('Internal Server Error');
  }
});


//DISPLAY LIST OF EMPLOYEES
router.get('/emplist', authMiddleware, async (req, res) => {
  try {
    // Retrieve and sort the employee list
    const employeelist = await EmpMstModel.find().sort({ emp_name: 1 });
    // Render the employee list view with the retrieved data
    res.render('emplist', {
      employeelist: employeelist,
      title: 'Employees list',
      userId: req.session.userId
    });
  } catch (err) {
    // Log the error and send an appropriate response
    console.error('Error retrieving employee list:', err);
    res.status(500).send('Internal server error');
  }
});



//Get leaves page
router.get('/leaves', authMiddleware, async (req, res, next) => {
  try {
    // Check if the user has the 'admin' role
    const rolecheck = await LogModel.countDocuments({ role: 'admin', emp_name: req.session.fullName });

    if (rolecheck > 0) {
      res.render('leaves', { title: 'Leaves page', userId: req.session.userId });
    } else {
      res.render('hi', { title: 'You are not authorised !!!', userId: req.session.userId });
    }
  } catch (err) {
    console.error('Error checking role:', err);
    res.status(500).send('Internal server error');
  }
});

//Add leave category
router.post("/addlv/", authMiddleware, async (req, res) => {
  try {
    const result = await LeaveMstModel.find({ leave_abb: req.body.lvabb }).countDocuments().exec();
    //console.log('Total count::::', result);

    if (result > 0) {
      console.log('Duplicate');
      res.render("hi", { title: "Duplicate record", userId: req.session.userId });
    } else {
      const lvData = {
        leave_abb: (req.body.lvabb).toUpperCase(),
        leave_desc: (req.body.lvdesc).toUpperCase(),
        leave_alloted: req.body.lvallot,
        remarks: req.body.lvrmrk
      };

      var data = new LeaveMstModel(lvData);
      await data.save();

      console.log(lvData);
      res.redirect('../leaves');
    }
  } catch (err) {
    console.log('Error:', err);
    res.status(500).send('Internal Server Error');
  }
});


//DISPLAY LEAVES CATEGORY
router.get('/leavetype', authMiddleware, async (req, res) => {
  try {
    // Fetch the leave types and sort them
    const lvlist = await LeaveMstModel.find().sort({ leave_abb: 1 });

    // Render the leave type view with the retrieved data
    res.render('leavetype', {
      lvlist: lvlist,
      title: "Leaves Category",
      userId: req.session.userId
    });
  } catch (err) {
    // Log the error and send an appropriate response
    console.error('Error retrieving leave types:', err);
    res.status(500).send('Internal server error');
  }
});


//EDIT EMPLOYEES
router.get('/edit-empl/:id', authMiddleware, async (req, res, next) => {
  var id = req.params.id;
  console.log(id);

  try {
    const data = await EmpMstModel.findById(id).exec();
    res.render('edit-empl', { empdata: data, title: "Edit Employee", userId: req.session.userId });
  } catch (err) {
    next(err);
  }
});


//Edit employee  ::POST method
router.post("/edit-empl", authMiddleware, async (req, res) => {
  const empData = {
    emp_name: (req.body.empname).toUpperCase(),
    year_of_joining: req.body.joinyr,
    gender: req.body.cmbGender,
    mob: req.body.txtmob,
    remarks: req.body.rmrk
  };
 // console.log(empData);

  try {
    await EmpMstModel.findByIdAndUpdate(req.body.id, empData).exec();
    res.redirect('../emplist');
  } catch (err) {
    console.log('Error:', err);
    res.status(500).send('Internal Server Error');
  }
});

//Leave entry
router.get("/attendance_entry", authMiddleware, async (req, res) => {
  try {
    const empdata = await EmpMstModel.find();
    const leavedata = await LeaveMstModel.find();
    const prm = await LogModel.find({ role: 'admin', emp_name: req.session.fullName });

    // console.log("prm variable ::::::::::::::::::::", prm.length);

    if (prm.length > 0) {
      console.log(prm.length);
      res.render('attendance_entry', {
        title: "Attendance entry",
        userId: req.session.userId,
        leavedata: leavedata,
        empdata: empdata,
        attData: "",
        moment: moment
      });
    } else {
      console.log(prm.length);
      return res.render("hi", {
        title: "You are not authorised",
        userId: req.session.userId
      });
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Internal Server Error');
  }
});

//ADD ATTENDANCE
router.post("/addatt/", authMiddleware, async (req, res) => {
  try {
    const result = await AttendanceModel.find({ emp_name: req.body.empnm, leave_date: req.body.dt }).countDocuments().exec();
    if (result > 0) {
      console.log('Duplicate');
      res.render("hi", { title: "Duplicate record", userId: req.session.userId });
    } else {
      const lvdt = moment(req.body.dt).format('dddd');
      if (lvdt == 'Sunday') {
        res.render("hi", { title: "Selected date is Sunday", userId: req.session.userId });
      } else {
        const prm = await LogModel.findOne({ role: 'admin', emp_name: req.session.fullName }).exec();
        if (prm) {
          const attData = {
            emp_name: (req.body.empnm).toUpperCase(),
            leave_type: (req.body.lvcat).toUpperCase(),
            leave_date: req.body.dt,
            enteredby: (req.session.fullName).toUpperCase(),
          };
          const data = new AttendanceModel(attData);
          await data.save();

          const empdata = await EmpMstModel.find().exec();
          const leavedata = await LeaveMstModel.find().exec();

          res.render('attendance_entry', { title: "Attendance entry", leavedata: leavedata, empdata: empdata, attData: attData, moment: moment, userId: req.session.userId });
        } else {
          res.render("hi", { title: "You are not authorized", userId: req.session.userId });
        }
      }
    }
  } catch (err) {
    console.log('Error:', err);
    res.status(500).send('Internal Server Error');
  }
});


//Access report page
router.get('/reports', authMiddleware, (req, res) => {

  res.render('reports', { title: "Report page", userId: req.session.userId });
});

//Daily attendance report
router.get('/dailyreport', authMiddleware, async (req, res) => {
  try {
    const empdata = await EmpMstModel.find().exec();
    const lv = await LeaveMstModel.find().exec();
    const yr = moment().year();

    res.render('dailyreport', {
      title: "Individual attendance report",
      empdata: empdata,
      moment: moment,
      year: yr,
      userId: req.session.userId,
      lvdata: lv
    });
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal Server Error');
  }
});


//Individual report :: POST menthod
router.post('/individualrpt', authMiddleware, async (req, res) => {
  const currentdate = new Date();
  const empname = req.body.empnm;
  const chkleaves = req.body.chkleaves || [''];
  const stdate = new Date(req.body.stdt);
  const enddate = new Date(req.body.enddt);

  const matchCondition = {
    emp_name: empname,
    leave_date: { $gte: stdate, $lte: enddate }
  };

  const selectedLv = Array.isArray(chkleaves) ? chkleaves : [chkleaves].filter(Boolean);
  if (selectedLv.length > 0) {
    matchCondition["Leave.leave_abb"] = { $in: selectedLv };
  }

  try {
    const data = await AttendanceModel.aggregate([
      {
        $lookup: {
          from: "leave_masters",
          localField: "leave_type",
          foreignField: "leave_abb",
          as: "Leave"
        }
      },
      { $unwind: "$Leave" },
      {
        $match: matchCondition
      },
      { $sort: { "leave_date": 1 } }
    ]);

    const totalDays = Math.ceil(data.reduce((count, record) => {
      const leaveDate = new Date(record.leave_date);
      return count + (leaveDate.getDay() === 6 ? 0.5 : 1);
    }, 0));

    if (totalDays > 0) {
      res.render('individualreport', {
        heading: "Employee Attendance Report",
        title: empname,
        data: data,
        dept: "COE Office",
        moment: moment,
        stdate: stdate,
        enddate: enddate,
        curdt: currentdate,
        totalRecords: totalDays
      });
    } else {
      res.render("hi", { title: "No leaves in this period", userId: req.session.userId });
    }
  } catch (err) {
    console.log("Error:", err);
    res.status(500).send('Internal Server Error');
  }
});



//Summary Report :: Get method
router.get('/summaryreport', authMiddleware, async (req, res) => {
  try {
    const empdata = await EmpMstModel.find().exec();
    const yr = moment().year();

    res.render('summaryreport', {
      title: "Summarised report",
      empdata: empdata,
      moment: moment,
      year: yr,
      userId: req.session.userId
    });
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal Server Error');
  }
});

//Summary report :: POST method
router.post('/summaryrpt', authMiddleware, async (req, res) => {
  const currentdate = new Date();
  const stdate = new Date(req.body.stdt);
  const enddate = new Date(req.body.enddt);

  try {
    const data = await AttendanceModel.aggregate([
      {
        $lookup: {
          from: "leave_masters",
          localField: "leave_type",
          foreignField: "leave_abb",
          as: "Leave"
        }
      },
      { $unwind: "$Leave" },
      {
        $match: { leave_date: { $gte: stdate, $lte: enddate } }
      },
      {
        $group: {
          _id: {
            emp_name: "$emp_name",
            leave_type: "$Leave.leave_desc",
            leave_date: "$leave_date" // Include leave_date for Saturday checking
          },
          totalLeaves: { $sum: 1 } // Count the number of leaves for each employee
        }
      },
      { $sort: { "_id.emp_name": 1, "_id.leave_type": 1 } }
    ]);

    // Create an object to hold adjusted totals for each employee
    const adjustedTotals = {};

    // Calculate total leaves considering Saturdays as 0.5
    data.forEach(record => {
      const leaveDate = new Date(record._id.leave_date);
      const isSaturday = leaveDate.getDay() === 6; // 6 means Saturday
      const adjustedLeaves = isSaturday ? 0.5 : 1; // Count Saturday as 0.5

      const empName = record._id.emp_name;
      const leaveType = record._id.leave_type;

      if (!adjustedTotals[empName]) {
        adjustedTotals[empName] = {};
      }

      if (!adjustedTotals[empName][leaveType]) {
        adjustedTotals[empName][leaveType] = 0;
      }

      adjustedTotals[empName][leaveType] += adjustedLeaves; // Accumulate adjusted leaves
    });

    // Convert adjusted totals into an array format
    const formattedPivotTable = Object.keys(adjustedTotals).map(empName => {
      const leaveData = { emp_name: empName };

      Object.keys(adjustedTotals[empName]).forEach(leaveType => {
        leaveData[`${leaveType}_total_leaves`] = Math.ceil(adjustedTotals[empName][leaveType]); // Use Math.floor to ensure integer
      });

      return leaveData;
    });

    // Calculate total records as an integer
    const totalRecords = Math.ceil(formattedPivotTable.reduce((sum, row) => {
      return sum + Object.values(row).filter(v => typeof v === 'number').reduce((a, b) => a + b, 0);
    }, 0));

    res.render('summreport', {
      title: "Summarised Attendance Report",
      data: formattedPivotTable,
      dept: "COE Office",
      moment: moment,
      stdate: stdate,
      enddate: enddate,
      curdt: currentdate,
      totalRecords: totalRecords // This will be an integer
    });
  } catch (err) {
    console.log("Error:", err);
    res.status(500).send('Internal Server Error');
  }
});


//Login Post Form
router.post('/login', async (req, res, next) => {
  try {
    // Find a user with the given emp_name
    const user = await LogModel.findOne({ emp_name: (req.body.txtuser).toUpperCase() });

    // If user is not found or password is incorrect
    if (!user || !(await bcrypt.compare(req.body.txtpwd, user.password))) {
      console.log('Invalid credentials');
      return res.render("hi", { title: "Invalid credentials", userId: req.session.userId });
    }

    // Extract first name from full name
    const namePart = req.body.txtuser.split(" ");
    const firstName = namePart[0];

    // Set session variables
    req.session.userId = (firstName).toUpperCase();
    req.session.fullName = req.body.txtuser;
    //console.log(req.session.userId);

    // Render the introduction page
    res.render("index", { title: "Introduction page", userId: req.session.userId });
  } catch (err) {
    console.log(err);
    // Handle errors appropriately
    return next(err);
  }
});


//Signup get method
router.get('/signup', async (req, res) => {
  try {
    const empdata = await EmpMstModel.find().exec();
    res.render('signup', { title: "Signup page", empdata: empdata, userId: req.session.userId });
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal Server Error');
  }
});



//Signup post form
router.post('/signup', async (req, res) => {
  try {
    const result = await LogModel.countDocuments({ emp_name: req.body.empname });
    if (result > 0) {
      console.log("Duplicate name");
      res.render('hi', { title: "Duplicate name", userId: req.session.userId });
    } else {
      if (req.body.txtcnfrmpwd == req.body.txtpwd) {

        const employeelist = await EmpMstModel.find({ emp_name: req.body.empname }).sort({ emp_name: 1 });
        const logindata = {
          emp_name: req.body.empname,
          password: req.body.txtpwd,
        };
        const LogData = new LogModel(logindata);

        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(LogData.password, saltRounds);

        // Set the hashed password
        LogData.password = hashedPassword;

        // Save the new user to the Database
        await LogData.save();

        const Loglist = await LogModel.find().sort({ emp_name: 1 });

        res.render('login', { title: "Login form", userId: req.session.userId, empdata: Loglist });

      } else {
        res.render('hi', { title: "Password didn't match", userId: req.session.userId });
      }
    }
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal server error');
  }
});


//Logout 
router.get('/logout', async (req, res, next) => {
  try {
    await req.session.destroy();
    res.redirect('/');
  } catch (err) {
    next(err);
  }
});





//ABOUT PAGE
router.get('/about', (req, res) => {
  res.render('about', { title: "This is about page", userId: req.session.userId });
});




module.exports = router;

//END OF FILE
