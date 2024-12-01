// Constants
const API_ENDPOINT =
  "https://qjup4ril4e.execute-api.us-east-1.amazonaws.com/v4";
const API_KEY = "NKAqDtCHdK9a7O5gxO3s73FRmnx9KMAN4Hpk29OG";

async function searchPhotos() {
  const searchQuery = document.getElementById("searchInput").value;
  const resultsDiv = document.getElementById("searchResults");

  try {
    const response = await fetch(
      `${API_ENDPOINT}/search?q=${encodeURIComponent(searchQuery)}`,
      {
        headers: {
          "X-API-Key": API_KEY,
        },
      }
    );

    const data = await response.json();
    displayResults(data.results);
  } catch (error) {
    console.error("Error searching photos:", error);
    resultsDiv.innerHTML = "Error searching photos";
  }
}

function displayResults(results) {
  const resultsDiv = document.getElementById("searchResults");
  resultsDiv.innerHTML = "";

  if (!results || results.length === 0) {
    resultsDiv.innerHTML = "<p>No images found</p>";
    return;
  }

  results.forEach((photo) => {
    const photoCard = document.createElement("div");
    photoCard.className = "photo-card";

    // Get photo details from _source
    const photoDetails = photo._source;
    const imageUrl = `https://photo-album-1.s3.us-east-1.amazonaws.com/${photoDetails.objectKey}`;

    // Create image element with proper error handling
    const img = new Image();
    img.className = "photo-image";
    let retryCount = 0;
    const maxRetries = 3;

    img.onload = function () {
      photoCard.querySelector(".image-container").innerHTML = "";
      photoCard.querySelector(".image-container").appendChild(img);
    };

    img.onerror = function () {
      retryCount++;
      if (retryCount <= maxRetries) {
        setTimeout(() => {
          img.src = imageUrl + "?retry=" + retryCount;
        }, 1000 * Math.pow(2, retryCount - 1));
      } else {
        photoCard.querySelector(".image-container").innerHTML =
          '<div class="error-message">Image failed to load</div>';
      }
    };

    photoCard.innerHTML = `
            <div class="image-container">
                <div class="loading">Loading...</div>
            </div>
            <div class="labels">
                <p><strong>Labels:</strong></p>
                <p>${photoDetails.labels.join(", ")}</p>
                <p class="timestamp">Created: ${new Date(
                  photoDetails.createdTimestamp
                ).toLocaleDateString()}</p>
            </div>
        `;

    resultsDiv.appendChild(photoCard);
    img.src = imageUrl;
  });
}


function getFileExtension(filename) {
    return filename.includes('.') ? filename.split('.').pop() : 'No extension';
}

async function uploadPhoto() {
  const fileInput = document.getElementById("photoInput");
  const customLabels = document.getElementById("customLabels").value;
  const statusDiv = document.getElementById("uploadStatus");

  if (!fileInput.files[0]) {
    statusDiv.innerHTML = "Please select a file";
    return;
  }

  const file = fileInput.files[0];
  const fileName = file.name;

//   console.log(file.name)

    file_type_ext = "image/"+getFileExtension(file.name)

  try {

    const arrayBuffer = await file.arrayBuffer();

    const response = await fetch(`${API_ENDPOINT}/photos?bucket=photo-album-1&key=${fileName}`, {
      method: "PUT",
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": file_type_ext,
        "x-amz-meta-customLabels": customLabels,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Api-Key,x-amz-meta-customLabels",
        "Access-Control-Allow-Methods": "PUT,OPTIONS",
      },
      body: arrayBuffer,
    });

    if (response.ok) {
      statusDiv.innerHTML = "Photo uploaded successfully!";
      fileInput.value = "";
      document.getElementById("customLabels").value = "";
    } else {
      throw new Error("Upload failed");
    }
  } catch (error) {
    console.error("Error uploading photo:", error);
    statusDiv.innerHTML = "Error uploading photo";
  }
}
// Event Listeners
document
  .getElementById("searchInput")
  .addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      searchPhotos();
    }
  });
