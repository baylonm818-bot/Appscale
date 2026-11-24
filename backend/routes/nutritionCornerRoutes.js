const express = require('express');
const router = express.Router();
const roleCheck = require('../middleware/roleMiddleware');
const {
  getConsolidation,
  getMonthlyMonitoring,
  getUnweighedChildren,
  getPrograms,
  addProgram,
  updateProgram,
  deleteProgram,
  getLaws,
  addLaw,
  updateLaw,
  deleteLaw,
  saveSchoolData,
} = require('../controllers/nutritionCornerControllers');

// Tab A: Consolidation of Nutritional Status (all authenticated roles can view)
router.get('/consolidation', getConsolidation);

// Tab B: BNS Monthly Weight Monitoring Chart (all authenticated roles can view)
router.get('/monthly-monitoring', getMonthlyMonitoring);

// Tab B Detail: Unweighed Children Modal
router.get('/unweighed-children', getUnweighedChildren);

// Tab C: Programs (all authenticated roles can view)
router.get('/programs', getPrograms);

// Tab C Admin Management: Add, Edit, Delete Programs
router.post('/programs', roleCheck(['admin']), addProgram);
router.put('/programs/:id', roleCheck(['admin']), updateProgram);
router.delete('/programs/:id', roleCheck(['admin']), deleteProgram);

// Tab D: Laws and References (all authenticated roles can view)
router.get('/laws', getLaws);

// Tab D Admin Management: Add, Edit, Delete Laws
router.post('/laws', roleCheck(['admin']), addLaw);
router.put('/laws/:id', roleCheck(['admin']), updateLaw);
router.delete('/laws/:id', roleCheck(['admin']), deleteLaw);

// School Children Data Entry (Admin only)
router.post('/school-data', roleCheck(['admin']), saveSchoolData);

module.exports = router;
