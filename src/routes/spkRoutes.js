const express = require('express');
const router = express.Router();

router.post('/saw', (req, res) => {
    const { alternatif } = req.body;

    // proses SAW disini

    res.json({
        success: true,
        hasil: alternatif
    });
});

module.exports = router;