const assert = require('assert');
const _ = require('lodash');

const multer = require('multer');
const multerS3 = require('multer-s3');

/**
 * WIP: implement standardized web upload
 *  - multipart file data
 *  - ...
 */
exports.__metadata = {
    name: 's3.upload',
    description: 'uploads a file to an S3 bucket',
    triggers: {
        action: {
            params: {
                bucket: 'string',
                key: 'string',
            },
        }
    }
}

exports.action = async function({ params={}, context={}, deps }) {
    const { logger, s3 } = deps.resolve('logger', 's3');

    logger.info('executing action (name="s3.upload")');

    const { bucket, key, formDataParameter="file" } = params;
    
	const upload = multer({
		storage: multerS3({
			s3,
			bucket,
			contentType: multerS3.AUTO_CONTENT_TYPE,
			// metadata: function (req, file, cb) {
				// cb(null, { jobId: job_.get('id') });
		  	// },
		  	key: function (req, file, cb) {
				cb(null, key);
		  	}
		})
	})

	const uploadF = upload.single(formDataParameter);
	const { req, res } = context;

	return new Promise((resolve, reject) => {
		uploadF(req, res, err => {
			if (err) return reject(err);

			resolve(req.file);
		});
	})
}